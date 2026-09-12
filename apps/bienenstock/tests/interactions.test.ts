import { describe, expect, it } from "vitest";
import {
  DISTURBANCE_RECOVERY_WITHIN_S,
  NECTAR_SPIKE_VISIBLE_WITHIN_S,
  boostPatch,
  countBeesInState,
  countBeesWorkingPatch,
  createColony,
  disturbHive,
  emptyPatch,
  fingerprint,
  meanHiveDistance,
  spikeNectar,
  step,
} from "@/lib/bienen/colony";
import type { FlowerPatchSpec } from "@/lib/bienen/world";

function shortId(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${(h >>> 0).toString(16)}`;
}

const EQUAL_PATCHES: readonly FlowerPatchSpec[] = [
  { id: 0, x: 8, z: 0, richness: 1, initialNectar: 400 },
  { id: 1, x: -8, z: 0, richness: 1, initialNectar: 400 },
];

const DT = 0.05;
const FLEE_MIN_SPREAD = 4;

function run(colony: ReturnType<typeof createColony>, seconds: number): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    step(colony, DT);
  }
}

function waitUntilWorking(
  colony: ReturnType<typeof createColony>,
  patchId: number,
  minBees: number,
  maxSeconds: number,
): boolean {
  const maxSteps = Math.round(maxSeconds / DT);
  for (let i = 0; i < maxSteps; i++) {
    step(colony, DT);
    if (countBeesWorkingPatch(colony, patchId) >= minBees) {
      return true;
    }
  }
  return false;
}

describe("nectar spike", () => {
  it("shifts the distribution toward a boosted patch within 20 simulated seconds", () => {
    const seed = 19;
    const beeCount = 24;
    const colony = createColony({ seed, beeCount, patches: EQUAL_PATCHES });

    const found = waitUntilWorking(colony, 1, 3, 30);
    expect(found, "warmup must put bees on the unboosted patch").toBe(true);

    const onPoor = colony.bees.filter(
      (bee) => bee.patchId === 1 && (bee.state === "outbound" || bee.state === "foraging"),
    );
    expect(onPoor.length).toBeGreaterThanOrEqual(3);

    const before0 = countBeesWorkingPatch(colony, 0);
    const before1 = countBeesWorkingPatch(colony, 1);
    const visits0Before = colony.patches[0]!.visits;
    const visits1Before = colony.patches[1]!.visits;

    boostPatch(colony, 0);

    for (const bee of onPoor) {
      expect(bee.patchId).toBe(0);
      expect(bee.state).toBe("outbound");
    }

    run(colony, NECTAR_SPIKE_VISIBLE_WITHIN_S);

    const after0 = countBeesWorkingPatch(colony, 0);
    const after1 = countBeesWorkingPatch(colony, 1);
    const deltaVisits0 = colony.patches[0]!.visits - visits0Before;
    const deltaVisits1 = colony.patches[1]!.visits - visits1Before;

    console.log(
      `nectar-spike seed=${seed} bees=${beeCount} window=${NECTAR_SPIKE_VISIBLE_WITHIN_S}s ` +
        `before working0=${before0} working1=${before1} ` +
        `after working0=${after0} working1=${after1} ` +
        `deltaVisits0=${deltaVisits0} deltaVisits1=${deltaVisits1} ` +
        `reassignedFrom1=${onPoor.length}`,
    );

    expect(after0).toBeGreaterThan(after1);
    expect(after0).toBeGreaterThan(before0);
    // Visits, not collected share: collectRate × richness can skew nectar even when choice is even.
    expect(deltaVisits0).toBeGreaterThan(deltaVisits1);
    expect(deltaVisits0).toBeGreaterThan(deltaVisits1 * 2);
    expect(deltaVisits0).toBeGreaterThan(0);
  });

  it("leaves an emptied patch and keeps running when every patch is empty", () => {
    const colony = createColony({
      seed: 8,
      beeCount: 16,
      patches: EQUAL_PATCHES,
    });
    expect(waitUntilWorking(colony, 0, 2, 30)).toBe(true);

    emptyPatch(colony, 0);
    expect(countBeesWorkingPatch(colony, 0)).toBe(0);
    expect(colony.patches[0]!.nectar).toBe(0);

    emptyPatch(colony, 1);
    expect(colony.patches[1]!.nectar).toBe(0);

    const timeBefore = colony.time;
    run(colony, 15);
    expect(colony.time).toBeGreaterThan(timeBefore);
    expect(countBeesWorkingPatch(colony, 0)).toBe(0);
    expect(countBeesWorkingPatch(colony, 1)).toBe(0);
    expect(countBeesInState(colony, "inHive")).toBe(colony.bees.length);

    console.log(
      `empty-meadow seed=8 bees=16 inHive=${countBeesInState(colony, "inHive")} ` +
        `time=${colony.time.toFixed(2)} hiveNectar=${colony.hive.nectar.toFixed(3)}`,
    );
  });
});

describe("hive disturbance", () => {
  it("scatters then returns to a stable foraging state within 20 simulated seconds", () => {
    const seed = 23;
    const beeCount = 40;
    const recoverySteps = Math.round(DISTURBANCE_RECOVERY_WITHIN_S / DT);
    const colony = createColony({ seed, beeCount, patches: EQUAL_PATCHES });
    run(colony, 12);

    const visitsBefore = colony.patches[0]!.visits + colony.patches[1]!.visits;
    disturbHive(colony);

    expect(countBeesInState(colony, "fleeing")).toBe(beeCount);
    const spreadAtAlarm = meanHiveDistance(colony);

    const homed = new Set<number>();
    let peakSpread = spreadAtAlarm;
    for (let i = 0; i < recoverySteps; i++) {
      step(colony, DT);
      peakSpread = Math.max(peakSpread, meanHiveDistance(colony));
      for (const bee of colony.bees) {
        if (bee.state === "inHive") {
          homed.add(bee.id);
        }
      }
    }

    const fleeing = countBeesInState(colony, "fleeing");
    const inHive = countBeesInState(colony, "inHive");
    const outbound = countBeesInState(colony, "outbound");
    const foraging = countBeesInState(colony, "foraging");
    const returning = countBeesInState(colony, "returning");
    const foragingStates = outbound + foraging + returning + inHive;
    const visitsAfter = colony.patches[0]!.visits + colony.patches[1]!.visits;
    const spreadAfter = meanHiveDistance(colony);

    console.log(
      `disturbance seed=${seed} bees=${beeCount} steps=${recoverySteps} ` +
        `window=${DISTURBANCE_RECOVERY_WITHIN_S}s ` +
        `fleeingAfter=${fleeing} homed=${homed.size} ` +
        `inHive=${inHive} outbound=${outbound} foraging=${foraging} returning=${returning} ` +
        `peakSpread=${peakSpread.toFixed(3)} spreadAfter=${spreadAfter.toFixed(3)} ` +
        `visitsBefore=${visitsBefore} visitsAfter=${visitsAfter}`,
    );

    expect(fleeing).toBe(0);
    expect(foragingStates).toBe(beeCount);
    // Re-homing: every bee was in the hive after the disturb. A model that scatters and
    // never returns keeps homed.size at 0, so this fails even if bees later forage from
    // wherever they were flung.
    expect(homed.size).toBe(beeCount);
    expect(peakSpread).toBeGreaterThan(FLEE_MIN_SPREAD);
    expect(outbound + foraging).toBeGreaterThan(0);
    expect(visitsAfter).toBeGreaterThan(visitsBefore);
  });
});

describe("interaction determinism", () => {
  it("the same seed and interaction script produce identical state", () => {
    const seed = 37;
    const beeCount = 40;

    function script() {
      const colony = createColony({ seed, beeCount, patches: EQUAL_PATCHES });
      run(colony, 8);
      boostPatch(colony, 0);
      run(colony, 4);
      emptyPatch(colony, 1);
      run(colony, 3);
      spikeNectar(colony, 1, 120);
      run(colony, 2);
      disturbHive(colony);
      run(colony, 10);
      return colony;
    }

    const a = script();
    const b = script();
    const fpA = fingerprint(a);
    const fpB = fingerprint(b);
    const idA = shortId(fpA);
    const idB = shortId(fpB);

    console.log(
      `interaction-determinism seed=${seed} bees=${beeCount} ` +
        `runA=${idA} hiveA=${a.hive.nectar.toFixed(6)} ` +
        `runB=${idB} hiveB=${b.hive.nectar.toFixed(6)}`,
    );

    expect(idA).toBe(idB);
    expect(fpA).toBe(fpB);
    expect(a.time).toBe(b.time);
  });
});
