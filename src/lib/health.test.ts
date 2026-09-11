import { describe, expect, it } from "vitest";
import { healthPayload, healthSchema } from "@/lib/health";

describe("the health contract", () => {
  it("answers exactly what ticket 001 specifies", () => {
    expect(healthPayload()).toEqual({ ok: true, service: "gocklkatz" });
  });

  it("rejects a body that is not the agreed shape", () => {
    expect(() => healthSchema.parse({ ok: false, service: "gocklkatz" })).toThrow();
    expect(() => healthSchema.parse({ ok: true, service: "something-else" })).toThrow();
    expect(() => healthSchema.parse({ ok: true })).toThrow();
  });
});
