import { chooseNextCity } from "./choose";
import { distanceMatrix, heuristicMatrix } from "./distance";
import { candidatesAvoidingBlocked, tourUsesBlockedEdge, zeroBlockedPheromone } from "./edges";
import { DEFAULT_ACO_PARAMS } from "./params";
import { depositTours, evaporate, initialPheromone } from "./pheromone";
import { isCompleteTour, tourLength } from "./tour";
import type { AcoParams, Ant, City, Colony, Rng } from "./types";

export function createColony(
  cities: readonly City[],
  random: Rng,
  params: AcoParams = DEFAULT_ACO_PARAMS,
): Colony {
  if (cities.length < 2) {
    throw new Error("colony needs at least 2 cities");
  }
  const distances = distanceMatrix(cities);
  const eta = heuristicMatrix(distances);
  const tau = initialPheromone(cities.length, params.tau0);
  return {
    cities: cities.map((city) => ({ ...city })),
    distances,
    eta,
    tau,
    params: { ...params },
    iteration: 0,
    bestTour: null,
    bestLength: Number.POSITIVE_INFINITY,
    ants: spawnAnts(cities.length, params.antCount, random),
    blockedEdges: new Set(),
  };
}

export function spawnAnts(cityCount: number, antCount: number, random: Rng): Ant[] {
  if (antCount < 1) {
    throw new Error("antCount must be ≥ 1");
  }
  return Array.from({ length: antCount }, (_, id) => ({
    id,
    tour: [Math.floor(random() * cityCount) % cityCount],
  }));
}

export function antUnvisited(ant: Ant, cityCount: number): number[] {
  const visited = new Set(ant.tour);
  const unvisited: number[] = [];
  for (let city = 0; city < cityCount; city++) {
    if (!visited.has(city)) {
      unvisited.push(city);
    }
  }
  return unvisited;
}

export function isAntDone(ant: Ant, cityCount: number): boolean {
  return ant.tour.length >= cityCount;
}

export function allAntsDone(colony: Colony): boolean {
  const n = colony.cities.length;
  return colony.ants.every((ant) => isAntDone(ant, n));
}

/** Local rule: one ant picks the next city from pheromone × heuristic. */
export function stepAnt(colony: Colony, antIndex: number, random: Rng): Colony {
  const ant = colony.ants[antIndex];
  if (!ant) {
    throw new Error(`no ant at index ${antIndex}`);
  }
  const n = colony.cities.length;
  if (isAntDone(ant, n)) {
    return colony;
  }
  const from = ant.tour[ant.tour.length - 1]!;
  const unvisited = antUnvisited(ant, n);
  const candidates = candidatesAvoidingBlocked(from, unvisited, colony.blockedEdges);
  const nextCity = chooseNextCity(
    from,
    candidates,
    colony.tau,
    colony.eta,
    colony.params.alpha,
    colony.params.beta,
    random,
  );
  const ants = colony.ants.map((candidate, index) =>
    index === antIndex ? { ...candidate, tour: [...candidate.tour, nextCity] } : candidate,
  );
  return { ...colony, ants };
}

export function closeIteration(colony: Colony, random: Rng): Colony {
  const n = colony.cities.length;
  if (!allAntsDone(colony)) {
    throw new Error("cannot close iteration until every ant finished a tour");
  }

  const scored = colony.ants.map((ant) => {
    if (!isCompleteTour(ant.tour, n)) {
      throw new Error(`ant ${ant.id} tour is not a complete permutation`);
    }
    return { tour: ant.tour, length: tourLength(ant.tour, colony.distances) };
  });

  let tau = evaporate(colony.tau, colony.params.rho);
  tau = depositTours(tau, scored, colony.params.q);
  tau = zeroBlockedPheromone(tau, colony.blockedEdges);

  let bestTour = colony.bestTour;
  let bestLength = colony.bestLength;
  if (tourUsesBlockedEdge(bestTour, colony.blockedEdges)) {
    bestTour = null;
    bestLength = Number.POSITIVE_INFINITY;
  }
  for (const result of scored) {
    if (tourUsesBlockedEdge(result.tour, colony.blockedEdges)) {
      continue;
    }
    if (result.length < bestLength) {
      bestLength = result.length;
      bestTour = result.tour.slice();
    }
  }

  return {
    ...colony,
    tau,
    iteration: colony.iteration + 1,
    bestTour,
    bestLength,
    ants: spawnAnts(n, colony.params.antCount, random),
  };
}

/** One full ACO iteration: every ant builds a tour, then evaporate + deposit. */
export function runIteration(colony: Colony, random: Rng): Colony {
  let next = colony;
  const n = next.cities.length;
  for (let antIndex = 0; antIndex < next.ants.length; antIndex++) {
    while (!isAntDone(next.ants[antIndex]!, n)) {
      next = stepAnt(next, antIndex, random);
    }
  }
  return closeIteration(next, random);
}
