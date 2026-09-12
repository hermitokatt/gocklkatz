import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { healthResponseSchema } from "@/lib/health";

describe("GET /api/health", () => {
  it('returns a Zod-validated { ok: true, service: "demo-shell" } body', async () => {
    const response = GET();
    expect(response.status).toBe(200);

    const body: unknown = await response.json();
    const parsed = healthResponseSchema.parse(body);

    expect(parsed).toEqual({ ok: true, service: "demo-shell" });
  });
});
