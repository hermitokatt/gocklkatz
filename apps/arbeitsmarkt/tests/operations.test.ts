import { describe, expect, it } from "vitest";
import { getDataset } from "@/lib/dataset";
import {
  ALARM_IDS,
  FAILURE_POLICY,
  applyFailurePolicy,
  buildOperationalSnapshot,
  evaluateSource,
  getOperationalSnapshot,
  getSourceRegistry,
  isCollectionAllowed,
  type FailurePolicy,
  type RegistrySource,
} from "@/lib/pipeline";

describe("operational snapshot", () => {
  it("is deterministic for the committed registry and dataset", () => {
    const a = getOperationalSnapshot();
    const b = getOperationalSnapshot();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("derives quarantine from consecutive failures including refused_403", () => {
    const snapshot = getOperationalSnapshot();
    const ledger = snapshot.sources.find((s) => s.id === "syn-src-0003");
    expect(ledger).toBeDefined();
    expect(ledger!.operationalStatus).toBe("quarantined");
    expect(ledger!.status).toBe("quarantined");
    expect(ledger!.health.lastFailureOutcome).toBe("refused_403");
    expect(ledger!.health.consecutiveFailures).toBe(3);
    expect(ledger!.quarantineReason).toMatch(/refused response \(HTTP 403\)/);
  });

  it("derives back-off from two consecutive transport failures", () => {
    const snapshot = getOperationalSnapshot();
    const relay = snapshot.sources.find((s) => s.id === "syn-src-0004");
    expect(relay).toBeDefined();
    expect(relay!.operationalStatus).toBe("backed_off");
    expect(relay!.backoffUntil).toBeTruthy();
    expect(relay!.health.lastFailureOutcome).toBe("transport_failure");
  });

  it("keeps a healthy permitted source and an idle disabled source", () => {
    const snapshot = getOperationalSnapshot();
    const feed = snapshot.sources.find((s) => s.id === "syn-src-0001");
    const index = snapshot.sources.find((s) => s.id === "syn-src-0002");
    expect(feed!.operationalStatus).toBe("healthy");
    expect(feed!.status).toBe("permitted");
    expect(index!.status).toBe("disabled");
    expect(index!.operationalStatus).toBe("idle");
    expect(index!.health.lastAttemptAt).toBeNull();
    expect(isCollectionAllowed(index!)).toBe(false);
    expect(isCollectionAllowed(feed!)).toBe(true);
  });

  it("states budget window, consumption, and remaining", () => {
    const snapshot = getOperationalSnapshot();
    expect(snapshot.budgetWindow).toBe("rolling_24h_ending_at_anchor");
    const feed = snapshot.sources.find((s) => s.id === "syn-src-0001")!;
    expect(feed.budget.window).toBe("rolling_24h_ending_at_anchor");
    expect(feed.budget.consumed).toBe(5);
    expect(feed.budget.limit).toBe(100);
    expect(feed.budget.remaining).toBe(95);
    expect(feed.budget.windowStartsAt).toBeTruthy();
    expect(feed.budget.windowEndsAt).toBe(snapshot.anchorAt);
  });

  it("evaluates every named alarm with at least one firing and one clear", () => {
    const snapshot = getOperationalSnapshot();
    expect(snapshot.alarms.map((a) => a.id)).toEqual([...ALARM_IDS]);
    const firing = snapshot.alarms.filter((a) => a.state === "firing");
    const clear = snapshot.alarms.filter((a) => a.state === "clear");
    expect(firing.length).toBeGreaterThan(0);
    expect(clear.length).toBeGreaterThan(0);

    const quarantinedAlarm = snapshot.alarms.find((a) => a.id === "source_quarantined")!;
    expect(quarantinedAlarm.state).toBe("firing");
    expect(quarantinedAlarm.about).toMatch(/syn-src-0003/);

    const budgetAlarm = snapshot.alarms.find((a) => a.id === "budget_exhausted")!;
    expect(budgetAlarm.state).toBe("clear");
    expect(budgetAlarm.about).toBeNull();

    const disabledAlarm = snapshot.alarms.find((a) => a.id === "disabled_source_collected")!;
    expect(disabledAlarm.state).toBe("clear");
  });

  it("changes output when attempt records change", () => {
    const registry = getSourceRegistry();
    const dataset = getDataset();
    const baseline = buildOperationalSnapshot(registry, dataset);

    const mutated = {
      ...registry,
      sources: registry.sources.map((source) => {
        if (source.id !== "syn-src-0003") {
          return source;
        }
        return {
          ...source,
          attempts: [
            {
              at: "2024-06-30T15:00:00.000Z",
              outcome: "success" as const,
              httpStatus: 200,
            },
          ],
        };
      }),
    };

    const after = buildOperationalSnapshot(mutated, dataset);
    const beforeSrc = baseline.sources.find((s) => s.id === "syn-src-0003")!;
    const afterSrc = after.sources.find((s) => s.id === "syn-src-0003")!;
    expect(beforeSrc.operationalStatus).toBe("quarantined");
    expect(afterSrc.operationalStatus).toBe("healthy");
  });
});

describe("failure policy", () => {
  it("maps consecutive failures to back-off then quarantine", () => {
    expect(applyFailurePolicy(0)).toBe("ok");
    expect(applyFailurePolicy(1)).toBe("ok");
    expect(applyFailurePolicy(FAILURE_POLICY.consecutiveFailuresBeforeBackoff)).toBe("backed_off");
    expect(applyFailurePolicy(FAILURE_POLICY.consecutiveFailuresBeforeQuarantine)).toBe(
      "quarantined",
    );
  });

  /**
   * A-2: drive a synthetic source failure and assert quarantined state.
   * A deliberate no-op policy must make this assertion fail (see report).
   */
  it("drives a synthetic source failure into displayed quarantine state", () => {
    const registry = getSourceRegistry();
    const dataset = getDataset();
    const source = registry.sources.find((s) => s.id === "syn-src-0003") as RegistrySource;
    expect(source.attempts.some((a) => a.outcome === "refused_403")).toBe(true);

    const evaluated = evaluateSource(source, registry.meta.anchorAt, FAILURE_POLICY);
    expect(evaluated.operationalStatus).toBe("quarantined");
    expect(evaluated.status).toBe("quarantined");

    const snapshot = buildOperationalSnapshot(registry, dataset, FAILURE_POLICY);
    const displayed = snapshot.sources.find((s) => s.id === "syn-src-0003")!;
    expect(displayed.operationalStatus).toBe("quarantined");
    expect(displayed.quarantineReason).toBeTruthy();
  });

  it("a no-op failure policy leaves a failing source healthy (break probe)", () => {
    const noop: FailurePolicy = {
      consecutiveFailuresBeforeBackoff: Number.MAX_SAFE_INTEGER,
      consecutiveFailuresBeforeQuarantine: Number.MAX_SAFE_INTEGER,
      backoffIntervalMinutes: FAILURE_POLICY.backoffIntervalMinutes,
    };
    const registry = getSourceRegistry();
    const source = registry.sources.find((s) => s.id === "syn-src-0003")!;
    const evaluated = evaluateSource(source, registry.meta.anchorAt, noop);
    expect(evaluated.operationalStatus).toBe("healthy");
    expect(evaluated.status).toBe("permitted");
  });
});
