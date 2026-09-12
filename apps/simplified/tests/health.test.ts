import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";
import { getHealthResponse, HealthResponseSchema } from "@/lib/health";

describe("HealthResponseSchema", () => {
  it("accepts the canonical health payload", () => {
    const parsed = HealthResponseSchema.parse({
      ok: true,
      service: "simplified",
    });

    expect(parsed).toEqual({ ok: true, service: "simplified" });
  });

  it("rejects an invalid service name", () => {
    const result = HealthResponseSchema.safeParse({
      ok: true,
      service: "other",
    });

    expect(result.success).toBe(false);
  });

  it("rejects ok: false", () => {
    const result = HealthResponseSchema.safeParse({
      ok: false,
      service: "simplified",
    });

    expect(result.success).toBe(false);
  });
});

describe("getHealthResponse", () => {
  it("returns a schema-valid payload", () => {
    const response = getHealthResponse();
    expect(HealthResponseSchema.parse(response)).toEqual({
      ok: true,
      service: "simplified",
    });
  });
});

describe("GET /api/health", () => {
  it("returns JSON matching the health schema", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(HealthResponseSchema.parse(body)).toEqual({
      ok: true,
      service: "simplified",
    });
  });
});
