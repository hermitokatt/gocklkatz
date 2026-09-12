/**
 * Pure operational model: source health, budgets, failure policy, and alarms.
 *
 * No clock, no environment, no network. Given the committed source registry and dataset,
 * the snapshot is deterministic.
 */

import { z } from "zod";
import type { SyntheticDataset } from "@/lib/dataset";

export const ATTEMPT_OUTCOMES = ["success", "transport_failure", "refused_403"] as const;
export type AttemptOutcome = (typeof ATTEMPT_OUTCOMES)[number];

export const COMPLIANCE_STATUSES = ["permitted", "disabled"] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

/** Displayed registry status after policy: compliance plus derived quarantine. */
export const DISPLAY_STATUSES = ["permitted", "disabled", "quarantined"] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export const OPERATIONAL_STATUSES = ["idle", "healthy", "backed_off", "quarantined"] as const;
export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export const ALARM_IDS = [
  "source_quarantined",
  "source_backed_off",
  "budget_exhausted",
  "disabled_source_collected",
] as const;
export type AlarmId = (typeof ALARM_IDS)[number];

export type AlarmSeverity = "high" | "medium" | "low";
export type AlarmState = "firing" | "clear";

/**
 * Demonstration failure policy. Exported so tests can assert against the same numbers
 * the docs describe. Changing these values changes derived state — they are not decoration.
 */
export const FAILURE_POLICY = {
  consecutiveFailuresBeforeBackoff: 2,
  consecutiveFailuresBeforeQuarantine: 3,
  backoffIntervalMinutes: 120,
} as const;

export type FailurePolicy = {
  consecutiveFailuresBeforeBackoff: number;
  consecutiveFailuresBeforeQuarantine: number;
  backoffIntervalMinutes: number;
};

const namePartsSchema = z.object({
  prefix: z.string().min(1),
  middle: z.string().min(1),
  suffix: z.string().min(1),
});

const attemptSchema = z.object({
  at: z.string().datetime(),
  outcome: z.enum(ATTEMPT_OUTCOMES),
  httpStatus: z.number().int().nullable(),
});

const sourceSchema = z.object({
  id: z.string().regex(/^syn-src-\d{4}$/),
  synthetic: z.literal(true),
  displayName: z.string().regex(/^SRC-[A-Za-z]+$/),
  nameParts: namePartsSchema,
  complianceStatus: z.enum(COMPLIANCE_STATUSES),
  complianceRule: z.string().min(1),
  requestBudget: z.object({
    limit: z.number().int().positive(),
  }),
  attempts: z.array(attemptSchema),
});

const namePartSchema = z.object({
  token: z.string().min(1),
  meaning: z.string().min(1),
});

export const sourceRegistrySchema = z.object({
  meta: z.object({
    schemaVersion: z.literal(1),
    synthetic: z.literal(true),
    statement: z.string().min(1),
    anchorAt: z.string().datetime(),
    budgetWindow: z.literal("rolling_24h_ending_at_anchor"),
  }),
  legend: z.object({
    construction: z.literal("displayName = 'SRC-' + Prefix + Middle + Suffix"),
    prefixes: z.array(namePartSchema).min(1),
    middles: z.array(namePartSchema).min(1),
    suffixes: z.array(namePartSchema).min(1),
  }),
  policy: z.object({
    consecutiveFailuresBeforeBackoff: z.number().int().positive(),
    consecutiveFailuresBeforeQuarantine: z.number().int().positive(),
    backoffIntervalMinutes: z.number().int().positive(),
    note: z.string().min(1),
  }),
  sources: z.array(sourceSchema).min(1),
});

export type SourceRegistry = z.infer<typeof sourceRegistrySchema>;
export type RegistrySource = z.infer<typeof sourceSchema>;
export type SourceAttempt = z.infer<typeof attemptSchema>;

export type SourceBudget = {
  window: "rolling_24h_ending_at_anchor";
  windowEndsAt: string;
  windowStartsAt: string;
  limit: number;
  consumed: number;
  remaining: number;
};

export type SourceHealth = {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureOutcome: AttemptOutcome | null;
  consecutiveFailures: number;
  /** Derived label a reader can map to the timestamps above. */
  state: "idle" | "healthy" | "failing";
};

export type SourceSnapshot = {
  id: string;
  synthetic: true;
  displayName: string;
  complianceStatus: ComplianceStatus;
  complianceRule: string;
  /** permitted | disabled | quarantined — quarantine is derived, not a hand-typed label. */
  status: DisplayStatus;
  operationalStatus: OperationalStatus;
  health: SourceHealth;
  budget: SourceBudget;
  backoffUntil: string | null;
  quarantineReason: string | null;
};

export type AlarmSnapshot = {
  id: AlarmId;
  description: string;
  severity: AlarmSeverity;
  state: AlarmState;
  /** Present when firing — what the alarm is about. */
  about: string | null;
};

export type OperationalSnapshot = {
  anchorAt: string;
  budgetWindow: "rolling_24h_ending_at_anchor";
  policy: FailurePolicy & { note: string };
  datasetRecordCount: number;
  datasetSeed: number;
  syntheticStatement: string;
  sources: SourceSnapshot[];
  alarms: AlarmSnapshot[];
};

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/**
 * Compliance gate enforced in code. Disabled sources never enter a collection schedule.
 * Pointed at from the operations view — this is the enforcement, not a disclaimer.
 */
export function isCollectionAllowed(source: { complianceStatus: ComplianceStatus }): boolean {
  return source.complianceStatus === "permitted";
}

/** True when an attempt outcome counts as a failure for the consecutive-failure streak. */
export function isFailureOutcome(outcome: AttemptOutcome): boolean {
  return outcome === "transport_failure" || outcome === "refused_403";
}

/**
 * Apply the demonstration failure policy to a consecutive-failure count.
 * Exported so a deliberate no-op break can be proven to fail assertions that depend on quarantine.
 */
export function applyFailurePolicy(
  consecutiveFailures: number,
  policy: FailurePolicy = FAILURE_POLICY,
): "ok" | "backed_off" | "quarantined" {
  if (consecutiveFailures >= policy.consecutiveFailuresBeforeQuarantine) {
    return "quarantined";
  }
  if (consecutiveFailures >= policy.consecutiveFailuresBeforeBackoff) {
    return "backed_off";
  }
  return "ok";
}

function parseInstantMs(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid instant: ${iso}`);
  }
  return ms;
}

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(parseInstantMs(iso) + minutes * MS_PER_MINUTE).toISOString();
}

function windowStartIso(anchorAt: string): string {
  return new Date(parseInstantMs(anchorAt) - MS_PER_DAY).toISOString();
}

function sortAttempts(attempts: readonly SourceAttempt[]): SourceAttempt[] {
  return [...attempts].sort((a, b) => parseInstantMs(a.at) - parseInstantMs(b.at));
}

function consecutiveFailureCount(sorted: readonly SourceAttempt[]): number {
  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const attempt = sorted[i]!;
    if (!isFailureOutcome(attempt.outcome)) {
      break;
    }
    count += 1;
  }
  return count;
}

function lastOf(
  sorted: readonly SourceAttempt[],
  predicate: (a: SourceAttempt) => boolean,
): SourceAttempt | null {
  for (let i = sorted.length - 1; i >= 0; i--) {
    const attempt = sorted[i]!;
    if (predicate(attempt)) {
      return attempt;
    }
  }
  return null;
}

function quarantineReasonFor(
  consecutiveFailures: number,
  lastFailure: SourceAttempt | null,
  policy: FailurePolicy,
): string {
  const refused =
    lastFailure?.outcome === "refused_403"
      ? " The streak ends on a refused response (HTTP 403), recorded distinctly from a transport failure."
      : "";
  return (
    `Quarantined after ${consecutiveFailures} consecutive failures ` +
    `(threshold ${policy.consecutiveFailuresBeforeQuarantine}).${refused}`
  );
}

export function evaluateSource(
  source: RegistrySource,
  anchorAt: string,
  policy: FailurePolicy = FAILURE_POLICY,
): SourceSnapshot {
  const sorted = sortAttempts(source.attempts);
  const windowStartsAt = windowStartIso(anchorAt);
  const windowStartMs = parseInstantMs(windowStartsAt);
  const windowEndMs = parseInstantMs(anchorAt);

  const consumed = sorted.filter((a) => {
    const t = parseInstantMs(a.at);
    return t >= windowStartMs && t <= windowEndMs;
  }).length;

  const budget: SourceBudget = {
    window: "rolling_24h_ending_at_anchor",
    windowEndsAt: anchorAt,
    windowStartsAt,
    limit: source.requestBudget.limit,
    consumed,
    remaining: Math.max(0, source.requestBudget.limit - consumed),
  };

  const lastAttempt = sorted.length > 0 ? sorted[sorted.length - 1]! : null;
  const lastSuccess = lastOf(sorted, (a) => a.outcome === "success");
  const lastFailure = lastOf(sorted, (a) => isFailureOutcome(a.outcome));
  const consecutiveFailures = consecutiveFailureCount(sorted);

  const health: SourceHealth = {
    lastAttemptAt: lastAttempt?.at ?? null,
    lastSuccessAt: lastSuccess?.at ?? null,
    lastFailureAt: lastFailure?.at ?? null,
    lastFailureOutcome: lastFailure?.outcome ?? null,
    consecutiveFailures,
    state: sorted.length === 0 ? "idle" : consecutiveFailures > 0 ? "failing" : "healthy",
  };

  if (!isCollectionAllowed(source)) {
    return {
      id: source.id,
      synthetic: true,
      displayName: source.displayName,
      complianceStatus: source.complianceStatus,
      complianceRule: source.complianceRule,
      status: "disabled",
      operationalStatus: "idle",
      health,
      budget,
      backoffUntil: null,
      quarantineReason: null,
    };
  }

  const policyState = applyFailurePolicy(consecutiveFailures, policy);

  if (policyState === "quarantined") {
    return {
      id: source.id,
      synthetic: true,
      displayName: source.displayName,
      complianceStatus: source.complianceStatus,
      complianceRule: source.complianceRule,
      status: "quarantined",
      operationalStatus: "quarantined",
      health,
      budget,
      backoffUntil: null,
      quarantineReason: quarantineReasonFor(consecutiveFailures, lastFailure, policy),
    };
  }

  if (policyState === "backed_off") {
    const failureAt = lastFailure?.at ?? anchorAt;
    return {
      id: source.id,
      synthetic: true,
      displayName: source.displayName,
      complianceStatus: source.complianceStatus,
      complianceRule: source.complianceRule,
      status: "permitted",
      operationalStatus: "backed_off",
      health,
      budget,
      backoffUntil: addMinutesIso(failureAt, policy.backoffIntervalMinutes),
      quarantineReason: null,
    };
  }

  return {
    id: source.id,
    synthetic: true,
    displayName: source.displayName,
    complianceStatus: source.complianceStatus,
    complianceRule: source.complianceRule,
    status: "permitted",
    operationalStatus: sorted.length === 0 ? "idle" : "healthy",
    health,
    budget,
    backoffUntil: null,
    quarantineReason: null,
  };
}

const ALARM_META: Record<AlarmId, { description: string; severity: AlarmSeverity }> = {
  source_quarantined: {
    description: "A permitted source has been quarantined under the failure policy.",
    severity: "high",
  },
  source_backed_off: {
    description: "A permitted source is in back-off after consecutive failures.",
    severity: "medium",
  },
  budget_exhausted: {
    description: "A source has consumed its entire request budget in the stated window.",
    severity: "medium",
  },
  disabled_source_collected: {
    description:
      "A disabled source recorded an attempt — the compliance gate would have been bypassed.",
    severity: "high",
  },
};

export function evaluateAlarms(sources: readonly SourceSnapshot[]): AlarmSnapshot[] {
  const quarantined = sources.filter((s) => s.operationalStatus === "quarantined");
  const backedOff = sources.filter((s) => s.operationalStatus === "backed_off");
  const exhausted = sources.filter((s) => s.budget.remaining === 0 && s.budget.limit > 0);
  const disabledCollected = sources.filter(
    (s) => s.complianceStatus === "disabled" && s.health.lastAttemptAt !== null,
  );

  return ALARM_IDS.map((id) => {
    const meta = ALARM_META[id];
    if (id === "source_quarantined") {
      return {
        id,
        ...meta,
        state: quarantined.length > 0 ? "firing" : "clear",
        about:
          quarantined.length > 0
            ? quarantined.map((s) => `${s.id} (${s.displayName})`).join(", ")
            : null,
      };
    }
    if (id === "source_backed_off") {
      return {
        id,
        ...meta,
        state: backedOff.length > 0 ? "firing" : "clear",
        about:
          backedOff.length > 0
            ? backedOff.map((s) => `${s.id} (${s.displayName})`).join(", ")
            : null,
      };
    }
    if (id === "budget_exhausted") {
      return {
        id,
        ...meta,
        state: exhausted.length > 0 ? "firing" : "clear",
        about:
          exhausted.length > 0
            ? exhausted.map((s) => `${s.id} (${s.displayName})`).join(", ")
            : null,
      };
    }
    return {
      id,
      ...meta,
      state: disabledCollected.length > 0 ? "firing" : "clear",
      about:
        disabledCollected.length > 0
          ? disabledCollected.map((s) => `${s.id} (${s.displayName})`).join(", ")
          : null,
    };
  });
}

/**
 * Build the operational snapshot from the registry and dataset.
 * Dataset contributes provenance (seed, record count, synthetic statement); health and alarms
 * are derived from registry attempt records through the failure policy.
 */
export function buildOperationalSnapshot(
  registry: SourceRegistry,
  dataset: SyntheticDataset,
  policy: FailurePolicy = FAILURE_POLICY,
): OperationalSnapshot {
  const sources = registry.sources.map((source) =>
    evaluateSource(source, registry.meta.anchorAt, policy),
  );

  return {
    anchorAt: registry.meta.anchorAt,
    budgetWindow: registry.meta.budgetWindow,
    policy: {
      consecutiveFailuresBeforeBackoff: policy.consecutiveFailuresBeforeBackoff,
      consecutiveFailuresBeforeQuarantine: policy.consecutiveFailuresBeforeQuarantine,
      backoffIntervalMinutes: policy.backoffIntervalMinutes,
      note: registry.policy.note,
    },
    datasetRecordCount: dataset.meta.recordCount,
    datasetSeed: dataset.meta.seed,
    syntheticStatement: dataset.meta.statement,
    sources,
    alarms: evaluateAlarms(sources),
  };
}
