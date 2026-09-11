import { describe, expect, it } from "vitest";
import {
  AMEISEN_TSP_FIXTURE,
  blockEdge,
  chooseNextCity,
  constructTour,
  createColony,
  createRng,
  deposit,
  distanceMatrix,
  edgeKey,
  edgeWeight,
  evaporate,
  euclidean,
  heuristicMatrix,
  initialPheromone,
  injectChaos,
  isCompleteTour,
  isEdgeBlocked,
  parseTspFixture,
  pheromoneMass,
  runIteration,
  stepAnt,
  tourLength,
  tourUsesBlockedEdge,
} from "@/lib/ameisen";
import type { City } from "@/lib/ameisen";

const TRIANGLE: City[] = [
  { id: 0, name: "A", x: 0, y: 0 },
  { id: 1, name: "B", x: 3, y: 0 },
  { id: 2, name: "C", x: 3, y: 4 },
];

const SQUARE: City[] = [
  { id: 0, name: "SW", x: 0, y: 0 },
  { id: 1, name: "SE", x: 1, y: 0 },
  { id: 2, name: "NE", x: 1, y: 1 },
  { id: 3, name: "NW", x: 0, y: 1 },
];

describe("TSP fixture", () => {
  it("ships exactly 5 uniquely identified cities with finite coordinates", () => {
    expect(AMEISEN_TSP_FIXTURE.length).toBe(5);
    const ids = AMEISEN_TSP_FIXTURE.map((city) => city.id);
    expect(new Set(ids).size).toBe(AMEISEN_TSP_FIXTURE.length);
    for (const city of AMEISEN_TSP_FIXTURE) {
      expect(Number.isFinite(city.x)).toBe(true);
      expect(Number.isFinite(city.y)).toBe(true);
      expect(city.name.length).toBeGreaterThan(0);
    }
  });

  it("rebuilds a complete Euclidean distance matrix for the live fixture (not a truncated 10-city matrix)", () => {
    const distances = distanceMatrix(AMEISEN_TSP_FIXTURE);
    const n = AMEISEN_TSP_FIXTURE.length;
    expect(distances).toHaveLength(n);
    for (let i = 0; i < n; i++) {
      expect(distances[i]).toHaveLength(n);
      expect(distances[i]![i]).toBe(0);
      for (let j = i + 1; j < n; j++) {
        const d = euclidean(AMEISEN_TSP_FIXTURE[i]!, AMEISEN_TSP_FIXTURE[j]!);
        expect(distances[i]![j]).toBe(d);
        expect(distances[j]![i]).toBe(d);
        expect(d).toBeGreaterThan(0);
      }
    }
    // Complete undirected edge count: n(n-1)/2 → 10 at n=5.
    expect((n * (n - 1)) / 2).toBe(10);
  });

  it("rejects fixtures smaller than 5 cities", () => {
    expect(() => parseTspFixture(TRIANGLE)).toThrow();
    expect(() => parseTspFixture(SQUARE)).toThrow();
  });
});

describe("tour length", () => {
  it("returns 12 for a 3-4-5 triangle closed tour", () => {
    const distances = distanceMatrix(TRIANGLE);
    expect(euclidean(TRIANGLE[0]!, TRIANGLE[1]!)).toBe(3);
    expect(euclidean(TRIANGLE[1]!, TRIANGLE[2]!)).toBe(4);
    expect(euclidean(TRIANGLE[2]!, TRIANGLE[0]!)).toBe(5);
    expect(tourLength([0, 1, 2], distances)).toBe(12);
    expect(tourLength([0, 2, 1], distances)).toBe(12);
  });

  it("returns 4 for the unit square boundary and 4+2√2 for the crossed tour", () => {
    const distances = distanceMatrix(SQUARE);
    expect(tourLength([0, 1, 2, 3], distances)).toBe(4);
    expect(tourLength([0, 2, 1, 3], distances)).toBeCloseTo(2 + 2 * Math.SQRT2, 12);
  });
});

describe("pheromone evaporate + deposit", () => {
  it("evaporates off-diagonal mass by exactly (1 − ρ)", () => {
    const tau = initialPheromone(3, 2);
    expect(pheromoneMass(tau)).toBe(2 * 3 * 2);
    const next = evaporate(tau, 0.25);
    expect(pheromoneMass(next)).toBe(0.75 * pheromoneMass(tau));
    expect(next[0]![0]).toBe(0);
    expect(next[0]![1]).toBe(1.5);
  });

  it("deposits Q/L on every undirected tour edge and nowhere else", () => {
    const tau = initialPheromone(4, 1);
    const distances = distanceMatrix(SQUARE);
    const tour = [0, 1, 2, 3];
    const length = tourLength(tour, distances);
    expect(length).toBe(4);
    const next = deposit(tau, tour, length, 8);
    const delta = 8 / 4;
    expect(next[0]![1]).toBe(1 + delta);
    expect(next[1]![0]).toBe(1 + delta);
    expect(next[1]![2]).toBe(1 + delta);
    expect(next[2]![3]).toBe(1 + delta);
    expect(next[3]![0]).toBe(1 + delta);
    expect(next[0]![2]).toBe(1);
    expect(next[1]![3]).toBe(1);
  });
});

describe("edge choice τ^α · η^β", () => {
  it("computes attractiveness with real exponents", () => {
    expect(edgeWeight(2, 0.5, 2, 1)).toBe(4 * 0.5);
    expect(edgeWeight(4, 2, 0.5, 2)).toBe(2 * 4);
  });

  it("picks the only city with positive weight", () => {
    const tau = [
      [0, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ];
    const eta = [
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ];
    for (let i = 0; i < 20; i++) {
      const choice = chooseNextCity(0, [1, 2], tau, eta, 1, 1, () => 0.99);
      expect(choice).toBe(1);
    }
  });
});

describe("colony iteration", () => {
  it("constructs a permutation tour via local ant steps", () => {
    const rng = createRng(7);
    let colony = createColony(SQUARE, rng, {
      alpha: 1,
      beta: 2,
      rho: 0.5,
      q: 4,
      tau0: 1,
      antCount: 1,
    });
    const n = SQUARE.length;
    while (colony.ants[0]!.tour.length < n) {
      colony = stepAnt(colony, 0, rng);
    }
    expect(isCompleteTour(colony.ants[0]!.tour, n)).toBe(true);
    expect(tourLength(colony.ants[0]!.tour, colony.distances)).toBeGreaterThan(0);
  });

  it("keeps best length monotone and equal to the recorded tour's length", () => {
    const rng = createRng(35);
    let colony = createColony(AMEISEN_TSP_FIXTURE, rng);
    let previousBest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 24; i++) {
      colony = runIteration(colony, rng);
      expect(colony.iteration).toBe(i + 1);
      expect(colony.bestTour).not.toBeNull();
      expect(isCompleteTour(colony.bestTour!, AMEISEN_TSP_FIXTURE.length)).toBe(true);
      expect(colony.bestLength).toBeLessThanOrEqual(previousBest);
      expect(colony.bestLength).toBeCloseTo(tourLength(colony.bestTour!, colony.distances), 10);
      previousBest = colony.bestLength;
    }
    expect(colony.bestLength).toBeGreaterThan(0);
    expect(Number.isFinite(colony.bestLength)).toBe(true);
  });

  it("is deterministic for a fixed seed", () => {
    const run = (seed: number) => {
      const rng = createRng(seed);
      let colony = createColony(AMEISEN_TSP_FIXTURE, rng);
      colony = runIteration(colony, rng);
      return { best: colony.bestLength, tau00: colony.tau[0]![1] };
    };
    expect(run(99)).toEqual(run(99));
    expect(run(99).best).not.toEqual(run(100).best);
  });

  it("moves heuristic η to 1/d", () => {
    const distances = distanceMatrix(TRIANGLE);
    const eta = heuristicMatrix(distances);
    expect(eta[0]![1]).toBeCloseTo(1 / 3, 12);
    expect(eta[1]![2]).toBeCloseTo(1 / 4, 12);
    expect(eta[2]![0]).toBeCloseTo(1 / 5, 12);
    expect(eta[0]![0]).toBe(0);
  });
});

describe("chaos inject — blocked edges", () => {
  it("excludes a blocked edge from construction when another city is open", () => {
    const distances = distanceMatrix(SQUARE);
    const tau = initialPheromone(SQUARE.length, 1);
    const eta = heuristicMatrix(distances);
    const blocked = new Set([edgeKey(0, 1)]);
    for (let seed = 1; seed <= 40; seed++) {
      const tour = constructTour(0, SQUARE.length, tau, eta, 1, 2, createRng(seed), blocked);
      expect(isCompleteTour(tour, SQUARE.length)).toBe(true);
      for (let i = 0; i < tour.length - 1; i++) {
        expect(edgeKey(tour[i]!, tour[i + 1]!)).not.toBe(edgeKey(0, 1));
      }
    }
  });

  it("stepAnt never walks a blocked neighbor while alternatives exist", () => {
    const rng = createRng(3);
    let colony = createColony(SQUARE, rng, {
      alpha: 1,
      beta: 2,
      rho: 0.5,
      q: 4,
      tau0: 1,
      antCount: 1,
    });
    colony = blockEdge({ ...colony, ants: [{ id: 0, tour: [0] }] }, 0, 1);
    expect(isEdgeBlocked(colony.blockedEdges, 0, 1)).toBe(true);
    for (let trial = 0; trial < 25; trial++) {
      const stepped = stepAnt(colony, 0, createRng(trial + 10));
      expect(stepped.ants[0]!.tour[1]).not.toBe(1);
    }
  });

  it("invalidates gold when chaos blocks a best-tour edge, then recovers a valid best", () => {
    const rng = createRng(36);
    let colony = createColony(AMEISEN_TSP_FIXTURE, rng);
    for (let i = 0; i < 12; i++) {
      colony = runIteration(colony, rng);
    }
    expect(colony.bestTour).not.toBeNull();
    expect(colony.bestLength).toBeGreaterThan(0);

    colony = injectChaos(colony);
    expect(colony.blockedEdges.size).toBe(1);
    expect(colony.bestTour).toBeNull();
    expect(colony.bestLength).toBe(Number.POSITIVE_INFINITY);

    const blockedKey = [...colony.blockedEdges][0]!;
    for (let i = 0; i < 10; i++) {
      colony = runIteration(colony, rng);
    }
    expect(colony.bestTour).not.toBeNull();
    expect(Number.isFinite(colony.bestLength)).toBe(true);
    expect(colony.bestLength).toBeGreaterThan(0);
    expect(tourUsesBlockedEdge(colony.bestTour, colony.blockedEdges)).toBe(false);
    expect(colony.blockedEdges.has(blockedKey)).toBe(true);
  });
});
