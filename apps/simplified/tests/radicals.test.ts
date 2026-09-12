import { describe, expect, it } from "vitest";

import { GET as getRadicalByIdRoute } from "@/app/api/radicals/[id]/route";
import { GET as getRadicalsRoute } from "@/app/api/radicals/route";
import {
  getRadicalById,
  getRadicalDetail,
  listRadicals,
  RadicalDetailResponseSchema,
  RadicalIdParamSchema,
  RadicalListResponseSchema,
  RadicalSchema,
  RADICALS,
} from "@/lib/radicals";

describe("RadicalSchema + seed", () => {
  it("ships between 30 and 50 curated radicals", () => {
    expect(RADICALS.length).toBeGreaterThanOrEqual(30);
    expect(RADICALS.length).toBeLessThanOrEqual(50);
  });

  it("validates every seed entry and keeps pedagogical order", () => {
    for (const radical of RADICALS) {
      expect(RadicalSchema.parse(radical).id).toBe(radical.id);
    }

    const orders = RADICALS.map((r) => r.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("uses unique pedagogical order ranks", () => {
    const orders = RADICALS.map((r) => r.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("includes common shape-shift variants in the seed", () => {
    const byId = Object.fromEntries(RADICALS.map((r) => [r.id, r]));

    expect(byId.person.forms).toEqual(expect.arrayContaining(["人", "亻"]));
    expect(byId.water.forms).toEqual(expect.arrayContaining(["水", "氵"]));
    expect(byId.heart.forms).toEqual(expect.arrayContaining(["心", "忄"]));
    expect(byId.hand.forms).toEqual(expect.arrayContaining(["手", "扌"]));
  });

  it("uses unique ids", () => {
    const ids = RADICALS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("listRadicals / getRadicalDetail", () => {
  it("returns a schema-valid list sorted by ascending order", () => {
    const list = listRadicals();
    const radicals = RadicalListResponseSchema.parse(list).radicals;
    expect(radicals).toHaveLength(RADICALS.length);

    const orders = radicals.map((r) => r.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("returns a schema-valid detail for a known id", () => {
    const detail = getRadicalDetail("water");
    expect(detail).toBeDefined();
    expect(RadicalDetailResponseSchema.parse(detail).radical.id).toBe("water");
  });

  it("returns undefined for a missing or invalid id", () => {
    expect(getRadicalById("not-a-radical")).toBeUndefined();
    expect(getRadicalDetail("not-a-radical")).toBeUndefined();
    expect(getRadicalById("Not Valid")).toBeUndefined();
    expect(getRadicalDetail("Not Valid")).toBeUndefined();
  });
});

describe("RadicalIdParamSchema", () => {
  it("accepts lowercase slugs", () => {
    expect(RadicalIdParamSchema.parse("water")).toBe("water");
  });

  it("rejects empty or invalid ids", () => {
    expect(RadicalIdParamSchema.safeParse("").success).toBe(false);
    expect(RadicalIdParamSchema.safeParse("Water").success).toBe(false);
    expect(RadicalIdParamSchema.safeParse("has space").success).toBe(false);
  });
});

describe("GET /api/radicals", () => {
  it("returns the full seed list in ascending order", async () => {
    const response = await getRadicalsRoute();
    expect(response.status).toBe(200);

    const body = RadicalListResponseSchema.parse(await response.json());
    expect(body.radicals).toHaveLength(RADICALS.length);

    const orders = body.radicals.map((r) => r.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(body.radicals[0]?.order).toBe(Math.min(...orders));
  });
});

describe("GET /api/radicals/[id]", () => {
  it("returns detail for a known radical", async () => {
    const response = await getRadicalByIdRoute(new Request("http://localhost"), {
      params: Promise.resolve({ id: "person" }),
    });

    expect(response.status).toBe(200);
    const body = RadicalDetailResponseSchema.parse(await response.json());
    expect(body.radical.forms).toEqual(expect.arrayContaining(["人", "亻"]));
  });

  it("returns 404 for an unknown but well-formed id", async () => {
    const response = await getRadicalByIdRoute(new Request("http://localhost"), {
      params: Promise.resolve({ id: "not-a-radical" }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "Radical not found" });
  });

  it("returns 400 for an invalid id shape", async () => {
    const response = await getRadicalByIdRoute(new Request("http://localhost"), {
      params: Promise.resolve({ id: "Not Valid" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid radical id" });
  });
});
