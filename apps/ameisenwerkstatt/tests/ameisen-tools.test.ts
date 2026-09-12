import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as postToolsRoute } from "@/app/api/ameisen/tools/route";
import {
  ALLOWED_TOOL_NAMES,
  AMEISEN_MUTATE_SECRET_ENV,
  apiErrorSchema,
  bestTourResultSchema,
  invokeTool,
  listAllowedTools,
  mutateForbiddenSchema,
  simSnapshotSchema,
  stepResultSchema,
  toolRefusedSchema,
  trailResultSchema,
} from "@/lib/ameisen";
import { getSnapshot, resetSim } from "@/lib/ameisen/sim";

const TEST_SECRET = "test-ameisen-mutate-secret";

function jsonRequest(body: unknown, options?: { authorization?: string | null }): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options?.authorization !== null && options?.authorization !== undefined) {
    headers.authorization = options.authorization;
  } else if (options?.authorization === undefined) {
    headers.authorization = `Bearer ${TEST_SECRET}`;
  }
  return new Request("http://localhost/api/ameisen/tools", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("Ameisen DualAB-A tool allowlist", () => {
  beforeEach(() => {
    resetSim(37);
    process.env[AMEISEN_MUTATE_SECRET_ENV] = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env[AMEISEN_MUTATE_SECRET_ENV];
  });

  it("lists only the frozen allowlist", () => {
    expect(listAllowedTools()).toEqual([...ALLOWED_TOOL_NAMES]);
    expect(ALLOWED_TOOL_NAMES).toEqual(["getTrail", "getBestTour", "setParams", "step"]);
  });

  it("getTrail returns Zod-validated trail fields from the live colony", () => {
    const outcome = invokeTool({ tool: "getTrail" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok || outcome.tool !== "getTrail") {
      throw new Error("expected getTrail success");
    }
    const trail = trailResultSchema.parse(outcome.result);
    expect(trail.cities.length).toBeGreaterThanOrEqual(5);
    expect(trail.tau.length).toBe(trail.cities.length);
    expect(trail.iteration).toBe(0);
  });

  it("getBestTour then step updates best-so-far (happy tool path)", () => {
    const before = invokeTool({ tool: "getBestTour" });
    expect(before.ok).toBe(true);
    if (!before.ok || before.tool !== "getBestTour") {
      throw new Error("expected getBestTour success");
    }
    expect(bestTourResultSchema.parse(before.result).bestTour).toBeNull();

    const stepped = invokeTool({ tool: "step", args: { iterations: 2 } });
    expect(stepped.ok).toBe(true);
    if (!stepped.ok || stepped.tool !== "step") {
      throw new Error("expected step success");
    }
    const result = stepResultSchema.parse(stepped.result);
    expect(result.iterationsAdvanced).toBe(2);
    expect(result.snapshot.iteration).toBe(2);
    expect(result.snapshot.bestTour).not.toBeNull();

    const after = invokeTool({ tool: "getBestTour" });
    expect(after.ok).toBe(true);
    if (!after.ok || after.tool !== "getBestTour") {
      throw new Error("expected getBestTour success");
    }
    const best = bestTourResultSchema.parse(after.result);
    expect(best.bestTour).not.toBeNull();
    expect(best.bestLength).not.toBeNull();
    expect(best.iteration).toBe(2);
  });

  it("unknown tool name is refused with tool_refused (no invent)", () => {
    const outcome = invokeTool({ tool: "deleteColony", args: {} });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      throw new Error("expected refuse");
    }
    const body = toolRefusedSchema.parse(outcome.body);
    expect(body.error).toBe("tool_refused");
    expect(body.tool).toBe("deleteColony");
    expect(body.allowlist).toEqual([...ALLOWED_TOOL_NAMES]);
    expect(body.reason).toMatch(/allowlist/i);
  });

  it("allowlist miss (near-miss name) is refused the same way", () => {
    const outcome = invokeTool({ tool: "setParam", args: { alpha: 1 } });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      throw new Error("expected refuse");
    }
    const body = toolRefusedSchema.parse(outcome.body);
    expect(body.error).toBe("tool_refused");
    expect(body.tool).toBe("setParam");
    expect(body.allowlist).toContain("setParams");
  });

  it("setParams contract: required ACO fields accepted via Zod", () => {
    const outcome = invokeTool({
      tool: "setParams",
      args: { alpha: 2, beta: 3, rho: 0.25, antCount: 5 },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok || outcome.tool !== "setParams") {
      throw new Error("expected setParams success");
    }
    const snap = simSnapshotSchema.parse(outcome.result);
    expect(snap.params.alpha).toBe(2);
    expect(snap.params.beta).toBe(3);
    expect(snap.params.rho).toBe(0.25);
    expect(snap.params.antCount).toBe(5);
    expect(snap.ants).toHaveLength(5);
  });

  it("validation error shape is validation_failed with issues[]", () => {
    const outcome = invokeTool({ tool: "step", args: { iterations: 0 } });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      throw new Error("expected validation failure");
    }
    const error = apiErrorSchema.parse(outcome.body);
    expect(error.error).toBe("validation_failed");
    expect(error.issues.length).toBeGreaterThan(0);
    expect(error.issues[0]).toMatchObject({
      path: expect.any(String),
      message: expect.any(String),
    });
  });

  it("invalid setParams writes nothing to sim state", () => {
    const before = getSnapshot();
    const outcome = invokeTool({
      tool: "setParams",
      args: { alpha: -1, beta: 5, rho: 0.45, antCount: 10 },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      throw new Error("expected validation failure");
    }
    apiErrorSchema.parse(outcome.body);
    expect(getSnapshot()).toEqual(before);
  });

  it("POST /api/ameisen/tools mirrors invokeTool refuse + happy path", async () => {
    const refused = await postToolsRoute(jsonRequest({ tool: "runShell", args: {} }));
    expect(refused.status).toBe(400);
    toolRefusedSchema.parse(await refused.json());

    const ok = await postToolsRoute(jsonRequest({ tool: "getTrail", args: {} }));
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { tool: string; result: unknown };
    expect(body.tool).toBe("getTrail");
    trailResultSchema.parse(body.result);
  });

  it("POST /api/ameisen/tools fails closed without secret env", async () => {
    delete process.env[AMEISEN_MUTATE_SECRET_ENV];
    const before = getSnapshot();
    const response = await postToolsRoute(
      jsonRequest({ tool: "step", args: { iterations: 1 } }, { authorization: null }),
    );
    expect(response.status).toBe(403);
    mutateForbiddenSchema.parse(await response.json());
    expect(getSnapshot()).toEqual(before);
  });

  it("POST /api/ameisen/tools rejects wrong Bearer when secret is set", async () => {
    const before = getSnapshot();
    const response = await postToolsRoute(
      jsonRequest(
        { tool: "step", args: { iterations: 1 } },
        { authorization: "Bearer not-the-secret" },
      ),
    );
    expect(response.status).toBe(403);
    mutateForbiddenSchema.parse(await response.json());
    expect(getSnapshot()).toEqual(before);
  });
});
