import { describe, expect, it } from "vitest";
import { demoListSchema, demos, hasDeployment, type Demo } from "@/lib/demos";

/** The portfolio as ticket 001 froze it: these names, this order, these URLs. */
const EXPECTED = [
  ["ameisenwerkstatt", "Ameisenwerkstatt", "https://gocklkatz-ameisenwerkstatt.vercel.app"],
  ["bienenstock", "Bienenstock", "https://gocklkatz-bienenstock.vercel.app"],
  ["simplified", "Simplified", "https://gocklkatz-simplified.vercel.app"],
  ["arbeitsmarkt", "Arbeitsmarkt", "https://gocklkatz-arbeitsmarkt.vercel.app"],
];

describe("the demo list", () => {
  it("presents the four demos in the order the ticket fixes", () => {
    expect(demos.map((demo) => [demo.slug, demo.name, demo.url])).toEqual(EXPECTED);
  });

  it("satisfies its own schema", () => {
    expect(() => demoListSchema.parse(demos)).not.toThrow();
  });

  it("gives every demo a one-line description", () => {
    for (const demo of demos) {
      expect(demo.description.length).toBeGreaterThan(20);
      expect(demo.description).not.toContain("\n");
    }
  });

  it("records a deployment URL for every demo, whether or not it is live yet", () => {
    for (const demo of demos) {
      expect(demo.url).toMatch(/^https:\/\//);
    }
  });

  it("uses only the two statuses the ticket allows", () => {
    for (const demo of demos) {
      expect(["live", "in-development"]).toContain(demo.status);
    }
  });
});

describe("hasDeployment — the card's link rule, at the data level", () => {
  it("is true only for a live demo", () => {
    const live: Demo = { ...base(), status: "live" };
    const pending: Demo = { ...base(), status: "in-development" };
    expect(hasDeployment(live)).toBe(true);
    expect(hasDeployment(pending)).toBe(false);
  });

  it("rejects a status outside the two allowed values", () => {
    expect(() => demoListSchema.parse([{ ...base(), status: "soon" }])).toThrow();
  });
});

function base(): Demo {
  return {
    slug: "example",
    name: "Example",
    description: "A demo used only by this test.",
    url: "https://example.invalid",
    status: "in-development",
  };
}
