import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createColony, fingerprint, snapshot, step } from "@/lib/bienen/colony";
import { DEFAULT_BEE_COUNT } from "@/lib/bienen/params";
import type { FlowerPatchSpec } from "@/lib/bienen/world";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function simSource(name: string): string {
  return readFileSync(path.join(HERE, "..", "lib", "bienen", name), "utf8");
}

function shortId(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${(h >>> 0).toString(16)}`;
}

const TWO_PATCHES: readonly FlowerPatchSpec[] = [
  { id: 0, x: 8, z: 0, richness: 2.2, initialNectar: 400 },
  { id: 1, x: -8, z: 0, richness: 0.25, initialNectar: 400 },
];

describe("simulation sources", () => {
  it("do not call Math.random", () => {
    for (const name of ["colony.ts", "rng.ts", "world.ts", "params.ts", "types.ts"]) {
      expect(simSource(name), name).not.toMatch(/Math\.random/);
    }
  });
});

describe("determinism", () => {
  it("the same seed and step count produce identical state", () => {
    const seed = 37;
    const steps = 800;
    const dt = 0.05;
    const beeCount = 40;

    const a = createColony({ seed, beeCount });
    const b = createColony({ seed, beeCount });
    for (let i = 0; i < steps; i++) {
      step(a, dt);
      step(b, dt);
    }

    const fpA = fingerprint(a);
    const fpB = fingerprint(b);
    const idA = shortId(fpA);
    const idB = shortId(fpB);

    // Printed so a reader of the gate log can see both runs, not only the assertion.
    console.log(
      `determinism seed=${seed} steps=${steps} dt=${dt} bees=${beeCount} ` +
        `runA=${idA} hiveA=${a.hive.nectar.toFixed(6)} ` +
        `runB=${idB} hiveB=${b.hive.nectar.toFixed(6)}`,
    );

    expect(idA).toBe(idB);
    expect(fpA).toBe(fpB);
    expect(a.time).toBe(b.time);
    expect(a.time).toBeCloseTo(steps * dt, 10);
  });
});

describe("recruitment concentrates on the richer patch", () => {
  it("collects more nectar from the rich patch than a uniform split would", () => {
    const colony = createColony({
      seed: 11,
      beeCount: 24,
      patches: TWO_PATCHES,
    });
    const dt = 0.05;
    const steps = 2400;
    for (let i = 0; i < steps; i++) {
      step(colony, dt);
    }

    const rich = colony.patches.find((patch) => patch.id === 0)!;
    const poor = colony.patches.find((patch) => patch.id === 1)!;
    const totalCollected = rich.collected + poor.collected;
    const totalVisits = rich.visits + poor.visits;
    const richShare = totalCollected > 0 ? rich.collected / totalCollected : 0;

    console.log(
      `concentration seed=11 steps=${steps} richVisits=${rich.visits} poorVisits=${poor.visits} ` +
        `richCollected=${rich.collected.toFixed(3)} poorCollected=${poor.collected.toFixed(3)} ` +
        `richShare=${richShare.toFixed(3)} hive=${colony.hive.nectar.toFixed(3)}`,
    );

    expect(totalVisits).toBeGreaterThan(40);
    expect(totalCollected).toBeGreaterThan(10);
    // Uniform would be ~0.5. Richness + advertisements must beat that by a wide margin.
    expect(richShare).toBeGreaterThan(0.65);
    // Visits, not only collected share: collectRate × richness can skew nectar even when
    // patch choice is uniform (measured while proving this assertion fails).
    expect(rich.visits).toBeGreaterThan(poor.visits * 2);
    expect(rich.collected).toBeGreaterThan(poor.collected);
  });
});

describe("foraging state machine", () => {
  it("a bee that leaves the hive returns, and collecting moves nectar to the hive", () => {
    const colony = createColony({
      seed: 4,
      beeCount: 1,
      patches: [{ id: 0, x: 2.5, z: 0, richness: 1.2, initialNectar: 20 }],
    });
    const patchStart = colony.patches[0]!.nectar;
    const hiveStart = colony.hive.nectar;
    const bee = colony.bees[0]!;
    expect(bee.state).toBe("inHive");

    const seen = new Set<string>();
    let returned = false;
    for (let i = 0; i < 4000; i++) {
      step(colony, 0.05);
      seen.add(bee.state);
      if (
        seen.has("outbound") &&
        seen.has("foraging") &&
        seen.has("returning") &&
        bee.state === "inHive"
      ) {
        returned = true;
        break;
      }
    }

    expect(seen.has("outbound")).toBe(true);
    expect(seen.has("foraging")).toBe(true);
    expect(seen.has("returning")).toBe(true);
    expect(returned).toBe(true);
    expect(colony.patches[0]!.nectar).toBeLessThan(patchStart);
    expect(colony.hive.nectar).toBeGreaterThan(hiveStart);
    expect(colony.patches[0]!.collected).toBeGreaterThan(0);
  });

  it("a bee never carries more than its capacity", () => {
    const capacity = 0.4;
    const colony = createColony({
      seed: 9,
      beeCount: 12,
      patches: TWO_PATCHES,
      params: { capacity, collectRate: 3 },
    });
    for (let i = 0; i < 1500; i++) {
      step(colony, 0.05);
      for (const bee of colony.bees) {
        expect(bee.carried).toBeLessThanOrEqual(capacity + 1e-12);
      }
    }
    expect(snapshot(colony).bees).toHaveLength(12);
  });
});

describe("defaults", () => {
  it("createColony uses the default agent count", () => {
    const colony = createColony();
    expect(colony.bees).toHaveLength(DEFAULT_BEE_COUNT);
    expect(DEFAULT_BEE_COUNT).toBe(120);
  });
});
