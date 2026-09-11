import { cloneMatrix } from "./matrix";
import type { Colony } from "./types";

/** Canonical undirected edge id (`min:max`). */
export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function parseEdgeKey(key: string): [number, number] {
  const sep = key.indexOf(":");
  if (sep <= 0) {
    throw new Error(`invalid edge key ${key}`);
  }
  const a = Number(key.slice(0, sep));
  const b = Number(key.slice(sep + 1));
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
    throw new Error(`invalid edge key ${key}`);
  }
  return [a, b];
}

export function isEdgeBlocked(blocked: ReadonlySet<string>, a: number, b: number): boolean {
  return blocked.has(edgeKey(a, b));
}

export function blockedEdgeCount(blocked: ReadonlySet<string>): number {
  return blocked.size;
}

export function tourUsesBlockedEdge(
  tour: readonly number[] | null,
  blocked: ReadonlySet<string>,
): boolean {
  if (!tour || tour.length < 2 || blocked.size === 0) {
    return false;
  }
  for (let i = 0; i < tour.length; i++) {
    if (isEdgeBlocked(blocked, tour[i]!, tour[(i + 1) % tour.length]!)) {
      return true;
    }
  }
  return false;
}

/**
 * Neighbors the ant may step to. Blocked edges are dropped when any open
 * alternative exists; if every remaining hop is blocked, fall back so a
 * complete permutation can still be built.
 */
export function candidatesAvoidingBlocked(
  from: number,
  unvisited: readonly number[],
  blocked: ReadonlySet<string>,
): number[] {
  if (blocked.size === 0) {
    return [...unvisited];
  }
  const open = unvisited.filter((city) => !isEdgeBlocked(blocked, from, city));
  return open.length > 0 ? open : [...unvisited];
}

/** Zero τ on blocked undirected edges so trails and weights stay dead. */
export function zeroBlockedPheromone(tau: number[][], blocked: ReadonlySet<string>): number[][] {
  if (blocked.size === 0) {
    return tau;
  }
  const next = cloneMatrix(tau);
  for (const key of blocked) {
    const [a, b] = parseEdgeKey(key);
    if (next[a] && next[b]) {
      next[a]![b] = 0;
      next[b]![a] = 0;
    }
  }
  return next;
}

function applyBlocked(colony: Colony, blocked: ReadonlySet<string>): Colony {
  const blockedEdges = new Set(blocked);
  const invalid = tourUsesBlockedEdge(colony.bestTour, blockedEdges);
  return {
    ...colony,
    blockedEdges,
    bestTour: invalid ? null : colony.bestTour,
    bestLength: invalid ? Number.POSITIVE_INFINITY : colony.bestLength,
    tau: zeroBlockedPheromone(colony.tau, blockedEdges),
  };
}

export function blockEdge(colony: Colony, a: number, b: number): Colony {
  if (a === b) {
    return colony;
  }
  if (isEdgeBlocked(colony.blockedEdges, a, b)) {
    return colony;
  }
  const blocked = new Set(colony.blockedEdges);
  blocked.add(edgeKey(a, b));
  return applyBlocked(colony, blocked);
}

export function unblockEdge(colony: Colony, a: number, b: number): Colony {
  if (!isEdgeBlocked(colony.blockedEdges, a, b)) {
    return colony;
  }
  const blocked = new Set(colony.blockedEdges);
  blocked.delete(edgeKey(a, b));
  return applyBlocked(colony, blocked);
}

export function toggleBlockedEdge(colony: Colony, a: number, b: number): Colony {
  if (a === b) {
    return colony;
  }
  return isEdgeBlocked(colony.blockedEdges, a, b)
    ? unblockEdge(colony, a, b)
    : blockEdge(colony, a, b);
}

export function clearBlockedEdges(colony: Colony): Colony {
  if (colony.blockedEdges.size === 0) {
    return colony;
  }
  return applyBlocked(colony, new Set());
}

/** Longest unblocked edge on the gold tour, else the longest open graph edge. */
export function pickChaosEdge(colony: Colony): [number, number] | null {
  const n = colony.cities.length;
  const consider = (a: number, b: number, best: { edge: [number, number]; d: number } | null) => {
    if (a === b || isEdgeBlocked(colony.blockedEdges, a, b)) {
      return best;
    }
    const d = colony.distances[a]?.[b];
    if (d === undefined) {
      return best;
    }
    if (!best || d > best.d) {
      return { edge: [a, b] as [number, number], d };
    }
    return best;
  };

  let best: { edge: [number, number]; d: number } | null = null;
  const tour = colony.bestTour;
  if (tour && tour.length > 1) {
    for (let i = 0; i < tour.length; i++) {
      best = consider(tour[i]!, tour[(i + 1) % tour.length]!, best);
    }
    if (best) {
      return best.edge;
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      best = consider(i, j, best);
    }
  }
  return best?.edge ?? null;
}

/** Operator inject: block the spectacle edge (gold's longest hop when present). */
export function injectChaos(colony: Colony): Colony {
  const edge = pickChaosEdge(colony);
  if (!edge) {
    return colony;
  }
  return blockEdge(colony, edge[0], edge[1]);
}
