import { describe, expect, it } from "vitest";
import {
  AMEISEN_TSP_FIXTURE,
  allAntsDone,
  blockEdge,
  blockedEdgeNames,
  colonyProgress,
  createColony,
  createRng,
  decisionTable,
  DEFAULT_ACO_PARAMS,
  formatColonyParams,
  formatDecisionProbability,
  goldTourNames,
  isAntDone,
  iterationSpread,
  pheromonePeak,
  pheromoneTotalMass,
  runIteration,
  stepAnt,
  tauOnGoldShare,
  topDecisionPeek,
} from "@/lib/ameisen";
import type { Colony, Rng } from "@/lib/ameisen";

function finishAllTours(colony: Colony, rng: Rng): Colony {
  let next = colony;
  while (!allAntsDone(next)) {
    for (let i = 0; i < next.ants.length; i++) {
      while (!isAntDone(next.ants[i]!, next.cities.length)) {
        next = stepAnt(next, i, rng);
      }
    }
  }
  return next;
}

describe("iterationSpread", () => {
  it("scores complete valid tours and counts blocked discards", () => {
    const rng = createRng(37);
    const building = finishAllTours(createColony(AMEISEN_TSP_FIXTURE, rng), rng);
    const spread = iterationSpread(building);
    expect(spread.validCount).toBe(building.params.antCount);
    expect(spread.discardedCount).toBe(0);
    expect(spread.best).not.toBeNull();
    expect(spread.worst).not.toBeNull();
    expect(spread.mean).not.toBeNull();
    expect(spread.best!).toBeLessThanOrEqual(spread.mean!);
    expect(spread.mean!).toBeLessThanOrEqual(spread.worst!);

    const dock = building.cities.findIndex((c) => c.name === "Dock");
    const tor = building.cities.findIndex((c) => c.name === "Tor");
    expect(dock).toBeGreaterThanOrEqual(0);
    expect(tor).toBeGreaterThanOrEqual(0);
    const withBlock = blockEdge(building, dock, tor);
    const blockedSpread = iterationSpread(withBlock);
    expect(blockedSpread.discardedCount + blockedSpread.validCount).toBe(
      withBlock.params.antCount,
    );
    expect(blockedSpread.discardedCount).toBeGreaterThan(0);
  });

  it("returns empty spread when no ant has finished a tour", () => {
    const colony = createColony(AMEISEN_TSP_FIXTURE, createRng(3));
    const spread = iterationSpread(colony);
    expect(spread).toEqual({
      best: null,
      mean: null,
      worst: null,
      validCount: 0,
      discardedCount: 0,
    });
  });
});

describe("colonyProgress", () => {
  it("counts walking ants and furthest hop", () => {
    const colony = createColony(AMEISEN_TSP_FIXTURE, createRng(1));
    const progress = colonyProgress(colony);
    expect(progress.total).toBe(colony.params.antCount);
    expect(progress.walking).toBe(colony.params.antCount);
    expect(progress.home).toBe(0);
    expect(progress.furthestHop).toBe(1);
    expect(progress.cityCount).toBe(AMEISEN_TSP_FIXTURE.length);
    expect(progress.allHome).toBe(false);
  });

  it("marks allHome when every ant finished", () => {
    const rng = createRng(9);
    const done = finishAllTours(createColony(AMEISEN_TSP_FIXTURE, rng), rng);
    const progress = colonyProgress(done);
    expect(progress.allHome).toBe(true);
    expect(progress.home).toBe(done.params.antCount);
    expect(progress.walking).toBe(0);
    expect(progress.furthestHop).toBe(AMEISEN_TSP_FIXTURE.length);
  });
});

describe("tauOnGoldShare", () => {
  it("returns null without gold and a share in (0,1] with gold", () => {
    const fresh = createColony(AMEISEN_TSP_FIXTURE, createRng(2));
    expect(tauOnGoldShare(fresh)).toBeNull();
    expect(pheromoneTotalMass(fresh)).toBeGreaterThan(0);
    expect(pheromonePeak(fresh)).toBe(fresh.params.tau0);

    let colony = createColony(AMEISEN_TSP_FIXTURE, createRng(37));
    const rng = createRng(37);
    for (let i = 0; i < 8; i++) {
      colony = runIteration(colony, rng);
    }
    expect(colony.bestTour).not.toBeNull();
    const share = tauOnGoldShare(colony);
    expect(share).not.toBeNull();
    expect(share!).toBeGreaterThan(0);
    expect(share!).toBeLessThanOrEqual(1);

    const blocked = blockEdge(colony, colony.bestTour![0]!, colony.bestTour![1]!);
    expect(blocked.bestTour).toBeNull();
    expect(tauOnGoldShare(blocked)).toBeNull();
  });
});

describe("blockedEdgeNames + goldTourNames", () => {
  it("names blocked edges and the gold chain", () => {
    let colony = createColony(AMEISEN_TSP_FIXTURE, createRng(37));
    const rng = createRng(37);
    colony = runIteration(colony, rng);
    expect(goldTourNames(colony)).not.toBeNull();
    expect(goldTourNames(colony)!.length).toBe(AMEISEN_TSP_FIXTURE.length);

    const dock = colony.cities.findIndex((c) => c.name === "Dock");
    const tor = colony.cities.findIndex((c) => c.name === "Tor");
    colony = blockEdge(colony, dock, tor);
    const names = blockedEdgeNames(colony);
    expect(names).toHaveLength(1);
    expect(names[0]!.label).toBe("Dock—Tor");
    expect(goldTourNames(colony)).toBeNull();
  });
});

describe("decisionTable", () => {
  it("returns normalised candidate probabilities for a walking ant", () => {
    const colony = createColony(AMEISEN_TSP_FIXTURE, createRng(5));
    const table = decisionTable(colony, 0);
    expect(table).not.toBeNull();
    expect(table!.candidates.length).toBe(colony.cities.length - 1);
    const sum = table!.candidates.reduce((acc, row) => acc + row.probability, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(table!.candidates[0]!.probability).toBeGreaterThanOrEqual(
      table!.candidates[table!.candidates.length - 1]!.probability,
    );
  });

  it("returns null for a finished ant", () => {
    const rng = createRng(8);
    const done = finishAllTours(createColony(AMEISEN_TSP_FIXTURE, rng), rng);
    expect(decisionTable(done, 0)).toBeNull();
  });
});

describe("topDecisionPeek", () => {
  it("exposes the top candidate label and probability from decisionTable", () => {
    const colony = createColony(AMEISEN_TSP_FIXTURE, createRng(5));
    const table = decisionTable(colony, 0);
    const peek = topDecisionPeek(colony);
    expect(table).not.toBeNull();
    expect(peek).not.toBeNull();
    expect(peek!.fromName).toBe(table!.fromName);
    expect(peek!.toName).toBe(table!.candidates[0]!.cityName);
    expect(peek!.probability).toBe(table!.candidates[0]!.probability);
    expect(peek!.antId).toBe(table!.antId);
    expect(formatDecisionProbability(peek!.probability)).toMatch(/^\d+(\.\d)?%$/);
  });

  it("skips finished ants and finds the next walker", () => {
    const rng = createRng(12);
    let colony = createColony(AMEISEN_TSP_FIXTURE, rng);
    while (!isAntDone(colony.ants[0]!, colony.cities.length)) {
      colony = stepAnt(colony, 0, rng);
    }
    expect(decisionTable(colony, 0)).toBeNull();
    expect(isAntDone(colony.ants[1]!, colony.cities.length)).toBe(false);
    const peek = topDecisionPeek(colony);
    const table = decisionTable(colony, 1);
    expect(peek).not.toBeNull();
    expect(table).not.toBeNull();
    expect(peek!.antId).toBe(table!.antId);
    expect(peek!.toName).toBe(table!.candidates[0]!.cityName);
  });

  it("returns null when every ant is home", () => {
    const rng = createRng(8);
    const done = finishAllTours(createColony(AMEISEN_TSP_FIXTURE, rng), rng);
    expect(topDecisionPeek(done)).toBeNull();
  });
});

describe("formatDecisionProbability", () => {
  it("formats stable tabular percents", () => {
    expect(formatDecisionProbability(0.875)).toBe("87.5%");
    expect(formatDecisionProbability(1)).toBe("100%");
    expect(formatDecisionProbability(0)).toBe("0%");
    expect(formatDecisionProbability(Number.NaN)).toBe("—");
  });
});

describe("formatColonyParams", () => {
  it("renders the quiet Werkstatt footer genome from live params", () => {
    expect(formatColonyParams(DEFAULT_ACO_PARAMS)).toBe(
      "α 1 · β 5 · ρ 0.45 · Q 120 · τ₀ 1 · 10 Ameisen",
    );
  });

  it("follows colony.params after createColony", () => {
    const colony = createColony(AMEISEN_TSP_FIXTURE, createRng(11));
    expect(formatColonyParams(colony.params)).toBe(
      "α 1 · β 5 · ρ 0.45 · Q 120 · τ₀ 1 · 10 Ameisen",
    );
  });

  it("reflects non-default param values without inventing knobs", () => {
    expect(
      formatColonyParams({
        alpha: 2,
        beta: 3.5,
        rho: 0.1,
        q: 80,
        tau0: 0.25,
        antCount: 7,
      }),
    ).toBe("α 2 · β 3.5 · ρ 0.1 · Q 80 · τ₀ 0.25 · 7 Ameisen");
  });
});
