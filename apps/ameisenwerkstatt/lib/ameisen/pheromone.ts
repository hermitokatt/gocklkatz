import { cloneMatrix } from "./matrix";

export function initialPheromone(cityCount: number, tau0: number): number[][] {
  const tau: number[][] = Array.from({ length: cityCount }, () => Array<number>(cityCount).fill(0));
  for (let i = 0; i < cityCount; i++) {
    for (let j = 0; j < cityCount; j++) {
      if (i !== j) {
        tau[i]![j] = tau0;
      }
    }
  }
  return tau;
}

/** τ ← (1 − ρ) τ on off-diagonal entries. */
export function evaporate(tau: number[][], rho: number): number[][] {
  if (!(rho >= 0 && rho <= 1)) {
    throw new Error(`rho must be in [0, 1], got ${rho}`);
  }
  const keep = 1 - rho;
  const next = cloneMatrix(tau);
  for (let i = 0; i < next.length; i++) {
    for (let j = 0; j < next.length; j++) {
      if (i === j) {
        next[i]![j] = 0;
      } else {
        next[i]![j] = keep * tau[i]![j]!;
      }
    }
  }
  return next;
}

function addUndirected(tau: number[][], a: number, b: number, delta: number): void {
  if (a === b) {
    return;
  }
  tau[a]![b] = tau[a]![b]! + delta;
  tau[b]![a] = tau[b]![a]! + delta;
}

/** Deposit Q / L on every undirected edge of a closed tour. */
export function deposit(
  tau: number[][],
  tour: readonly number[],
  length: number,
  q: number,
): number[][] {
  if (!(length > 0) || !Number.isFinite(length)) {
    throw new Error(`deposit requires a positive finite tour length, got ${length}`);
  }
  const delta = q / length;
  const next = cloneMatrix(tau);
  for (let i = 0; i < tour.length; i++) {
    addUndirected(next, tour[i]!, tour[(i + 1) % tour.length]!, delta);
  }
  return next;
}

export function depositTours(
  tau: number[][],
  tours: readonly { tour: readonly number[]; length: number }[],
  q: number,
): number[][] {
  let next = cloneMatrix(tau);
  for (const scored of tours) {
    next = deposit(next, scored.tour, scored.length, q);
  }
  return next;
}

export function pheromoneMass(tau: number[][]): number {
  let mass = 0;
  for (const row of tau) {
    for (const value of row) {
      mass += value;
    }
  }
  return mass;
}

export function maxPheromone(tau: number[][]): number {
  let max = 0;
  for (const row of tau) {
    for (const value of row) {
      if (value > max) {
        max = value;
      }
    }
  }
  return max;
}
