import {
  apiErrorSchema,
  type ApiError,
  type SimSnapshot,
  type StepResult,
} from "./api-schemas";
import { advanceSteps, applyParams, getSnapshot } from "./sim";
import {
  ALLOWED_TOOL_NAMES,
  allowedToolNameSchema,
  bestTourResultSchema,
  getBestTourArgsSchema,
  getTrailArgsSchema,
  setParamsArgsSchema,
  stepArgsSchema,
  toolCallRequestSchema,
  toolRefusedSchema,
  trailResultSchema,
  type AllowedToolName,
  type BestTourResult,
  type ToolCallRequest,
  type ToolRefused,
  type TrailResult,
} from "./tool-schemas";

export type ToolSuccess =
  | { ok: true; tool: "getTrail"; result: TrailResult }
  | { ok: true; tool: "getBestTour"; result: BestTourResult }
  | { ok: true; tool: "setParams"; result: SimSnapshot }
  | { ok: true; tool: "step"; result: StepResult };

export type ToolFailure =
  | { ok: false; status: 400; body: ToolRefused }
  | { ok: false; status: 400; body: ApiError };

export type ToolOutcome = ToolSuccess | ToolFailure;

function validationError(parsed: {
  error: { issues: { path: PropertyKey[]; message: string }[] };
}): ApiError {
  return apiErrorSchema.parse({
    error: "validation_failed",
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.map(String).join(".") || "(root)",
      message: issue.message,
    })),
  });
}

function refuse(tool: string, reason: string): ToolFailure {
  return {
    ok: false,
    status: 400,
    body: toolRefusedSchema.parse({
      error: "tool_refused",
      tool,
      reason,
      allowlist: [...ALLOWED_TOOL_NAMES],
    }),
  };
}

function runGetTrail(rawArgs: unknown): ToolOutcome {
  const parsed = getTrailArgsSchema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { ok: false, status: 400, body: validationError(parsed) };
  }
  const snap = getSnapshot();
  return {
    ok: true,
    tool: "getTrail",
    result: trailResultSchema.parse({
      iteration: snap.iteration,
      cities: snap.cities,
      tau: snap.tau,
      blockedEdges: snap.blockedEdges,
    }),
  };
}

function runGetBestTour(rawArgs: unknown): ToolOutcome {
  const parsed = getBestTourArgsSchema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { ok: false, status: 400, body: validationError(parsed) };
  }
  const snap = getSnapshot();
  return {
    ok: true,
    tool: "getBestTour",
    result: bestTourResultSchema.parse({
      bestTour: snap.bestTour,
      bestLength: snap.bestLength,
      iteration: snap.iteration,
    }),
  };
}

function runSetParams(rawArgs: unknown): ToolOutcome {
  const parsed = setParamsArgsSchema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { ok: false, status: 400, body: validationError(parsed) };
  }
  const outcome = applyParams(parsed.data);
  if (!outcome.ok) {
    return { ok: false, status: outcome.status, body: outcome.body };
  }
  return { ok: true, tool: "setParams", result: outcome.snapshot };
}

function runStep(rawArgs: unknown): ToolOutcome {
  const parsed = stepArgsSchema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { ok: false, status: 400, body: validationError(parsed) };
  }
  const outcome = advanceSteps(parsed.data);
  if (!outcome.ok) {
    return { ok: false, status: outcome.status, body: outcome.body };
  }
  return { ok: true, tool: "step", result: outcome.result };
}

const runners: Record<AllowedToolName, (rawArgs: unknown) => ToolOutcome> = {
  getTrail: runGetTrail,
  getBestTour: runGetBestTour,
  setParams: runSetParams,
  step: runStep,
};

/**
 * DualAB-A tool dispatcher: allowlist gate → Zod args → existing sim façade.
 * Unknown tool names are refused; invalid genomes write nothing.
 */
export function invokeTool(raw: unknown): ToolOutcome {
  const envelope = toolCallRequestSchema.safeParse(raw);
  if (!envelope.success) {
    return { ok: false, status: 400, body: validationError(envelope) };
  }

  const call: ToolCallRequest = envelope.data;
  const name = allowedToolNameSchema.safeParse(call.tool);
  if (!name.success) {
    return refuse(
      call.tool,
      `tool "${call.tool}" is not on the DualAB-A allowlist; refused (no invent)`,
    );
  }

  return runners[name.data](call.args);
}

export function listAllowedTools(): readonly AllowedToolName[] {
  return ALLOWED_TOOL_NAMES;
}
