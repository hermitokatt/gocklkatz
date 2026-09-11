import { candidatesAvoidingBlocked } from "./edges";
import type { Rng } from "./types";

/** Classic ACO attractiveness: τ^α · η^β. */
export function edgeWeight(tau: number, eta: number, alpha: number, beta: number): number {
  return tau ** alpha * eta ** beta;
}

export function chooseNextCity(
  from: number,
  unvisited: readonly number[],
  tau: number[][],
  eta: number[][],
  alpha: number,
  beta: number,
  random: Rng,
): number {
  if (unvisited.length === 0) {
    throw new Error("chooseNextCity: no unvisited cities");
  }
  if (unvisited.length === 1) {
    return unvisited[0]!;
  }

  const weights = unvisited.map((city) =>
    edgeWeight(tau[from]![city]!, eta[from]![city]!, alpha, beta),
  );
  const sum = weights.reduce((acc, w) => acc + w, 0);

  if (!(sum > 0) || !Number.isFinite(sum)) {
    const index = Math.min(unvisited.length - 1, Math.floor(random() * unvisited.length));
    return unvisited[index]!;
  }

  let ticket = random() * sum;
  for (let i = 0; i < unvisited.length; i++) {
    ticket -= weights[i]!;
    if (ticket <= 0) {
      return unvisited[i]!;
    }
  }
  return unvisited[unvisited.length - 1]!;
}

export function constructTour(
  start: number,
  cityCount: number,
  tau: number[][],
  eta: number[][],
  alpha: number,
  beta: number,
  random: Rng,
  blocked: ReadonlySet<string> = new Set(),
): number[] {
  const tour = [start];
  const visited = new Set<number>([start]);
  while (tour.length < cityCount) {
    const from = tour[tour.length - 1]!;
    const unvisited: number[] = [];
    for (let city = 0; city < cityCount; city++) {
      if (!visited.has(city)) {
        unvisited.push(city);
      }
    }
    const next = chooseNextCity(
      from,
      candidatesAvoidingBlocked(from, unvisited, blocked),
      tau,
      eta,
      alpha,
      beta,
      random,
    );
    tour.push(next);
    visited.add(next);
  }
  return tour;
}
