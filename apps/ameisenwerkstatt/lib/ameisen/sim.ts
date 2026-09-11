import {
  simParamsRequestSchema,
  simSnapshotSchema,
  stepRequestSchema,
  stepResultSchema,
  type ApiError,
  type SimParamsRequest,
  type SimSnapshot,
  type StepRequest,
  type StepResult,
} from "./api-schemas";
import { createColony, runIteration, spawnAnts } from "./colony";
import { blockEdge, clearBlockedEdges, parseEdgeKey } from "./edges";
import { AMEISEN_TSP_FIXTURE } from "./fixture";
import { createRng } from "./rng";
import type { Colony, Rng } from "./types";

const DEFAULT_SEED = 37;

type SimState = {
  colony: Colony;
  random: Rng;
  seed: number;
};

let state: SimState | null = null;

function ensureState(): SimState {
  if (!state) {
    resetSim();
  }
  return state!;
}

/** Reset the shared server colony (tests + cold start). */
export function resetSim(seed: number = DEFAULT_SEED): SimSnapshot {
  const random = createRng(seed);
  const colony = createColony(AMEISEN_TSP_FIXTURE, random);
  state = { colony, random, seed };
  return snapshotOf(colony);
}

export function getColony(): Colony {
  return ensureState().colony;
}

export function snapshotOf(colony: Colony): SimSnapshot {
  return simSnapshotSchema.parse({
    cities: colony.cities,
    params: colony.params,
    iteration: colony.iteration,
    bestTour: colony.bestTour,
    bestLength: Number.isFinite(colony.bestLength) ? colony.bestLength : null,
    ants: colony.ants,
    blockedEdges: [...colony.blockedEdges].sort(),
    tau: colony.tau,
  });
}

export function getSnapshot(): SimSnapshot {
  return snapshotOf(ensureState().colony);
}

function validationError(parsed: {
  error: { issues: { path: PropertyKey[]; message: string }[] };
}): ApiError {
  return {
    error: "validation_failed",
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.map(String).join(".") || "(root)",
      message: issue.message,
    })),
  };
}

export type ParamsOutcome =
  | { ok: true; snapshot: SimSnapshot }
  | { ok: false; status: 400; body: ApiError };

export type StepOutcome =
  | { ok: true; result: StepResult }
  | { ok: false; status: 400; body: ApiError };

function applyBlockedKeys(colony: Colony, keys: readonly string[]): Colony {
  const n = colony.cities.length;
  let next = clearBlockedEdges(colony);
  for (const key of keys) {
    const [a, b] = parseEdgeKey(key);
    if (a < 0 || b < 0 || a >= n || b >= n) {
      throw new Error(`edge key ${key} out of range for ${n} cities`);
    }
    next = blockEdge(next, a, b);
  }
  return next;
}

/** Validate + apply params; on failure leave colony untouched. */
export function applyParams(raw: unknown): ParamsOutcome {
  const parsed = simParamsRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 400, body: validationError(parsed) };
  }

  const input: SimParamsRequest = parsed.data;
  const current = ensureState();

  try {
    if (input.blockedEdges) {
      // Dry-run range check before mutating the shared colony.
      applyBlockedKeys(current.colony, input.blockedEdges);
    }
  } catch (error) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "validation_failed",
        issues: [
          {
            path: "blockedEdges",
            message: error instanceof Error ? error.message : "invalid blockedEdges",
          },
        ],
      },
    };
  }

  let colony: Colony = {
    ...current.colony,
    params: {
      ...current.colony.params,
      alpha: input.alpha,
      beta: input.beta,
      rho: input.rho,
      antCount: input.antCount,
    },
  };

  if (input.antCount !== current.colony.params.antCount) {
    colony = {
      ...colony,
      ants: spawnAnts(colony.cities.length, input.antCount, current.random),
    };
  }

  if (input.blockedEdges) {
    colony = applyBlockedKeys(colony, input.blockedEdges);
  }

  current.colony = colony;
  return { ok: true, snapshot: snapshotOf(colony) };
}

/** Validate + advance N full ACO iterations; on failure leave colony untouched. */
export function advanceSteps(raw: unknown): StepOutcome {
  const parsed = stepRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 400, body: validationError(parsed) };
  }

  const input: StepRequest = parsed.data;
  const current = ensureState();
  let colony = current.colony;
  for (let i = 0; i < input.iterations; i++) {
    colony = runIteration(colony, current.random);
  }
  current.colony = colony;

  return {
    ok: true,
    result: stepResultSchema.parse({
      iterationsAdvanced: input.iterations,
      snapshot: snapshotOf(colony),
    }),
  };
}
