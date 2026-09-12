import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getSnapshotRoute } from "@/app/api/ameisen/snapshot/route";
import { POST as postParamsRoute } from "@/app/api/ameisen/params/route";
import { POST as postStepRoute } from "@/app/api/ameisen/step/route";
import {
  AMEISEN_MUTATE_SECRET_ENV,
  apiErrorSchema,
  DEFAULT_ACO_PARAMS,
  mutateForbiddenSchema,
  simSnapshotSchema,
  stepResultSchema,
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
  return new Request("http://localhost/api/ameisen", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("Ameisen DualAB-A sim API", () => {
  beforeEach(() => {
    resetSim(37);
    process.env[AMEISEN_MUTATE_SECRET_ENV] = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env[AMEISEN_MUTATE_SECRET_ENV];
  });

  it("GET snapshot returns a Zod-validated colony state", async () => {
    const response = getSnapshotRoute();
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    const snapshot = simSnapshotSchema.parse(body);
    expect(snapshot.cities.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.iteration).toBe(0);
    expect(snapshot.bestTour).toBeNull();
    expect(snapshot.bestLength).toBeNull();
    expect(snapshot.params.antCount).toBe(DEFAULT_ACO_PARAMS.antCount);
    expect(snapshot.ants).toHaveLength(DEFAULT_ACO_PARAMS.antCount);
    expect(snapshot.blockedEdges).toEqual([]);
    expect(snapshot.tau.length).toBe(snapshot.cities.length);
  });

  it("POST params updates alpha/beta/rho/antCount and optional blockedEdges", async () => {
    const response = await postParamsRoute(
      jsonRequest({
        alpha: 2,
        beta: 3,
        rho: 0.2,
        antCount: 4,
        blockedEdges: ["0:1"],
      }),
    );
    expect(response.status).toBe(200);
    const snapshot = simSnapshotSchema.parse(await response.json());
    expect(snapshot.params.alpha).toBe(2);
    expect(snapshot.params.beta).toBe(3);
    expect(snapshot.params.rho).toBe(0.2);
    expect(snapshot.params.antCount).toBe(4);
    expect(snapshot.ants).toHaveLength(4);
    expect(snapshot.blockedEdges).toEqual(["0:1"]);
    expect(getSnapshot().params.alpha).toBe(2);
  });

  it("POST params rejects invalid bodies with 400 and writes nothing", async () => {
    const before = getSnapshot();
    const response = await postParamsRoute(
      jsonRequest({
        alpha: -1,
        beta: 5,
        rho: 0.45,
        antCount: 10,
      }),
    );
    expect(response.status).toBe(400);
    const error = apiErrorSchema.parse(await response.json());
    expect(error.error).toBe("validation_failed");
    expect(error.issues.length).toBeGreaterThan(0);
    expect(getSnapshot()).toEqual(before);
  });

  it("POST params rejects out-of-range blockedEdges without mutating", async () => {
    const before = getSnapshot();
    const response = await postParamsRoute(
      jsonRequest({
        alpha: 1,
        beta: 5,
        rho: 0.45,
        antCount: 10,
        blockedEdges: ["0:99"],
      }),
    );
    expect(response.status).toBe(400);
    apiErrorSchema.parse(await response.json());
    expect(getSnapshot()).toEqual(before);
  });

  it("POST step advances N iterations and returns a typed step result", async () => {
    const response = await postStepRoute(jsonRequest({ iterations: 3 }));
    expect(response.status).toBe(200);
    const result = stepResultSchema.parse(await response.json());
    expect(result.iterationsAdvanced).toBe(3);
    expect(result.snapshot.iteration).toBe(3);
    expect(result.snapshot.bestTour).not.toBeNull();
    expect(result.snapshot.bestLength).not.toBeNull();
    expect(result.snapshot.bestLength!).toBeGreaterThan(0);
  });

  it("POST step rejects non-positive iterations with 400", async () => {
    const before = getSnapshot();
    const response = await postStepRoute(jsonRequest({ iterations: 0 }));
    expect(response.status).toBe(400);
    apiErrorSchema.parse(await response.json());
    expect(getSnapshot().iteration).toBe(before.iteration);
  });

  it("params then step keep one shared colony (no second invent)", async () => {
    await postParamsRoute(
      jsonRequest({
        alpha: 1.5,
        beta: 4,
        rho: 0.3,
        antCount: 6,
        blockedEdges: ["1:2"],
      }),
    );
    const stepped = stepResultSchema.parse(
      await (await postStepRoute(jsonRequest({ iterations: 2 }))).json(),
    );
    expect(stepped.snapshot.iteration).toBe(2);
    expect(stepped.snapshot.params.antCount).toBe(6);
    expect(stepped.snapshot.params.rho).toBe(0.3);
    expect(stepped.snapshot.blockedEdges).toEqual(["1:2"]);
    expect(getSnapshot().iteration).toBe(2);
  });
});

describe("Ameisen DualAB-A mutate gate (fail-closed)", () => {
  beforeEach(() => {
    resetSim(37);
    delete process.env[AMEISEN_MUTATE_SECRET_ENV];
  });

  afterEach(() => {
    delete process.env[AMEISEN_MUTATE_SECRET_ENV];
  });

  it("fails closed with 403 when secret env is unset (params + step)", async () => {
    const before = getSnapshot();
    const paramsRes = await postParamsRoute(
      jsonRequest({ alpha: 2, beta: 3, rho: 0.2, antCount: 4 }, { authorization: null }),
    );
    expect(paramsRes.status).toBe(403);
    mutateForbiddenSchema.parse(await paramsRes.json());

    const stepRes = await postStepRoute(jsonRequest({ iterations: 1 }, { authorization: null }));
    expect(stepRes.status).toBe(403);
    mutateForbiddenSchema.parse(await stepRes.json());
    expect(getSnapshot()).toEqual(before);
  });

  it("rejects missing or wrong Bearer when secret is set", async () => {
    process.env[AMEISEN_MUTATE_SECRET_ENV] = TEST_SECRET;
    const before = getSnapshot();

    const missing = await postStepRoute(jsonRequest({ iterations: 1 }, { authorization: null }));
    expect(missing.status).toBe(403);
    mutateForbiddenSchema.parse(await missing.json());

    const wrong = await postStepRoute(
      jsonRequest({ iterations: 1 }, { authorization: "Bearer wrong-secret" }),
    );
    expect(wrong.status).toBe(403);
    mutateForbiddenSchema.parse(await wrong.json());
    expect(getSnapshot()).toEqual(before);
  });

  it("allows mutate when Bearer matches the set secret", async () => {
    process.env[AMEISEN_MUTATE_SECRET_ENV] = TEST_SECRET;
    const response = await postStepRoute(
      jsonRequest({ iterations: 1 }, { authorization: `Bearer ${TEST_SECRET}` }),
    );
    expect(response.status).toBe(200);
    const result = stepResultSchema.parse(await response.json());
    expect(result.iterationsAdvanced).toBe(1);
    expect(getSnapshot().iteration).toBe(1);
  });

  it("GET snapshot stays public without a secret", async () => {
    const response = getSnapshotRoute();
    expect(response.status).toBe(200);
    simSnapshotSchema.parse(await response.json());
  });
});
