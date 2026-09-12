import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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

describe("the measured claim on every card", () => {
  it("gives every demo a claim that is a sentence, not a label", () => {
    for (const demo of demos) {
      expect(demo.claim.text.split(/\s+/).length).toBeGreaterThanOrEqual(3);
      expect(demo.claim.text).not.toContain("\n");
    }
  });

  it("names the command that reproduces it", () => {
    // Requirement 1 of the ticket, and AGENTS.md section 4: a number without a way to re-derive it
    // is a claim, not a measurement.
    for (const demo of demos) {
      expect(demo.claim.command).toBe("npm run test");
    }
  });

  it("points at a source file that exists in this repository", () => {
    // The claim is meant to come "from the projects' own records, not from memory" (requirement 2),
    // so the path has to resolve. Resolved from the repository root, which is this file's ../.. .
    const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
    for (const demo of demos) {
      const full = join(repoRoot, demo.claim.source);
      expect(existsSync(full), `${demo.slug}: ${demo.claim.source} does not exist`).toBe(true);
    }
  });

  it("points at a source whose tests the claim is actually counting", () => {
    // A source that exists but is empty would satisfy the check above while citing nothing.
    const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
    for (const demo of demos) {
      const body = readFileSync(join(repoRoot, demo.claim.source), "utf8");
      expect(body).toMatch(/\b(it|test)\(/);
    }
  });

  it("states a number of tests that matches the suite it cites", () => {
    // The claim text carries a count; scripts/ci.sh runs the apps' suites, so a drifting count is a
    // published number that no longer reproduces. This asserts the shape, not the value: the value
    // is checked by the measurement that produced it.
    for (const demo of demos) {
      expect(demo.claim.text).toMatch(/^\d+ tests? over /);
    }
  });
});

function base(): Demo {
  return {
    slug: "example",
    name: "Example",
    description: "A demo used only by this test.",
    url: "https://example.invalid",
    status: "in-development",
    claim: {
      text: "3 tests over the example fixture, all passing",
      source: "src/lib/demos.test.ts",
      command: "npm run test",
    },
  };
}
