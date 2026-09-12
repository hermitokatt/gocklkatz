import { edgeWeight } from "./choose";
import { antUnvisited, isAntDone } from "./colony";
import { candidatesAvoidingBlocked, parseEdgeKey, tourUsesBlockedEdge } from "./edges";
import { maxPheromone, pheromoneMass } from "./pheromone";
import { isCompleteTour, tourLength } from "./tour";
import type { AcoParams, Colony } from "./types";

export type IterationSpread = {
  best: number | null;
  mean: number | null;
  worst: number | null;
  validCount: number;
  discardedCount: number;
};

/** Best / mean / worst among complete tours that avoid blocked edges. */
export function iterationSpread(colony: Colony): IterationSpread {
  const n = colony.cities.length;
  const lengths: number[] = [];
  let discardedCount = 0;

  for (const ant of colony.ants) {
    if (!isCompleteTour(ant.tour, n)) {
      continue;
    }
    if (tourUsesBlockedEdge(ant.tour, colony.blockedEdges)) {
      discardedCount += 1;
      continue;
    }
    lengths.push(tourLength(ant.tour, colony.distances));
  }

  if (lengths.length === 0) {
    return { best: null, mean: null, worst: null, validCount: 0, discardedCount };
  }

  let best = lengths[0]!;
  let worst = lengths[0]!;
  let sum = 0;
  for (const length of lengths) {
    sum += length;
    if (length < best) {
      best = length;
    }
    if (length > worst) {
      worst = length;
    }
  }

  return {
    best,
    mean: sum / lengths.length,
    worst,
    validCount: lengths.length,
    discardedCount,
  };
}

export type ColonyProgress = {
  walking: number;
  home: number;
  total: number;
  furthestHop: number;
  cityCount: number;
  allHome: boolean;
};

/** Ants still crawling vs finished, plus the furthest hop so far. */
export function colonyProgress(colony: Colony): ColonyProgress {
  const cityCount = colony.cities.length;
  let walking = 0;
  let home = 0;
  let furthestHop = 0;

  for (const ant of colony.ants) {
    const hop = Math.min(ant.tour.length, cityCount);
    if (hop > furthestHop) {
      furthestHop = hop;
    }
    if (isAntDone(ant, cityCount)) {
      home += 1;
    } else {
      walking += 1;
    }
  }

  const total = colony.ants.length;
  return {
    walking,
    home,
    total,
    furthestHop,
    cityCount,
    allHome: home === total && total > 0,
  };
}

/**
 * Share of pheromone mass sitting on the undirected gold-tour edges.
 * Returns null when there is no gold (no referent for the share).
 */
export function tauOnGoldShare(colony: Colony): number | null {
  const tour = colony.bestTour;
  if (!tour || tour.length < 2) {
    return null;
  }
  const mass = pheromoneMass(colony.tau);
  if (!(mass > 0)) {
    return 0;
  }
  let onGold = 0;
  for (let i = 0; i < tour.length; i++) {
    const a = tour[i]!;
    const b = tour[(i + 1) % tour.length]!;
    onGold += colony.tau[a]![b]! + colony.tau[b]![a]!;
  }
  return onGold / mass;
}

export function pheromoneTotalMass(colony: Colony): number {
  return pheromoneMass(colony.tau);
}

export function pheromonePeak(colony: Colony): number {
  return maxPheromone(colony.tau);
}

export type BlockedEdgeName = {
  key: string;
  label: string;
};

/** Blocked edges labelled with both city names (em dash). */
export function blockedEdgeNames(colony: Colony): BlockedEdgeName[] {
  const names: BlockedEdgeName[] = [];
  for (const key of colony.blockedEdges) {
    const [a, b] = parseEdgeKey(key);
    const left = colony.cities[a]?.name ?? String(a);
    const right = colony.cities[b]?.name ?? String(b);
    names.push({ key, label: `${left}—${right}` });
  }
  names.sort((x, y) => x.label.localeCompare(y.label, "de"));
  return names;
}

/** Ordered city names on the gold tour, or null when gold is gone. */
export function goldTourNames(colony: Colony): string[] | null {
  const tour = colony.bestTour;
  if (!tour || tour.length === 0) {
    return null;
  }
  return tour.map((index) => colony.cities[index]?.name ?? String(index));
}

export type DecisionCandidate = {
  cityId: number;
  cityName: string;
  tau: number;
  distance: number;
  weight: number;
  probability: number;
};

export type DecisionTable = {
  antId: number;
  fromId: number;
  fromName: string;
  hop: number;
  cityCount: number;
  candidates: DecisionCandidate[];
};

/**
 * τ^α · η^β decision breakdown for one ant (readout 6).
 * Werkstatt STE-52 renders only the top candidate via `topDecisionPeek`.
 */
export function decisionTable(colony: Colony, antIndex = 0): DecisionTable | null {
  const ant = colony.ants[antIndex];
  if (!ant) {
    return null;
  }
  const cityCount = colony.cities.length;
  if (isAntDone(ant, cityCount)) {
    return null;
  }
  const from = ant.tour[ant.tour.length - 1]!;
  const unvisited = antUnvisited(ant, cityCount);
  const candidates = candidatesAvoidingBlocked(from, unvisited, colony.blockedEdges);
  const { alpha, beta } = colony.params;

  const weighted = candidates.map((cityId) => {
    const tau = colony.tau[from]![cityId]!;
    const eta = colony.eta[from]![cityId]!;
    const weight = edgeWeight(tau, eta, alpha, beta);
    return {
      cityId,
      cityName: colony.cities[cityId]?.name ?? String(cityId),
      tau,
      distance: colony.distances[from]![cityId]!,
      weight,
    };
  });

  const total = weighted.reduce((sum, row) => sum + row.weight, 0);
  const rows: DecisionCandidate[] = weighted
    .map((row) => ({
      ...row,
      probability: total > 0 ? row.weight / total : 0,
    }))
    .sort((a, b) => b.probability - a.probability);

  return {
    antId: ant.id,
    fromId: from,
    fromName: colony.cities[from]?.name ?? String(from),
    hop: ant.tour.length,
    cityCount,
    candidates: rows,
  };
}

export type TopDecisionPeek = {
  antId: number;
  fromName: string;
  toName: string;
  probability: number;
  hop: number;
  cityCount: number;
};

/**
 * Compact top-candidate peek (STE-52 / AMEISENFABRIK-UI §8 Q2).
 * First walking ant; derives from `decisionTable` — no extra sim math.
 */
export function topDecisionPeek(colony: Colony): TopDecisionPeek | null {
  for (let antIndex = 0; antIndex < colony.ants.length; antIndex++) {
    const table = decisionTable(colony, antIndex);
    const top = table?.candidates[0];
    if (!table || !top) {
      continue;
    }
    return {
      antId: table.antId,
      fromName: table.fromName,
      toName: top.cityName,
      probability: top.probability,
      hop: table.hop,
      cityCount: table.cityCount,
    };
  }
  return null;
}

/** Stable percent string for the Werkstatt peek value (tabular figures). */
export function formatDecisionProbability(probability: number): string {
  if (!Number.isFinite(probability)) {
    return "—";
  }
  const pct = probability * 100;
  if (pct >= 99.95) {
    return "100%";
  }
  if (pct < 0.05) {
    return "0%";
  }
  return `${pct.toFixed(1)}%`;
}

/** Compact read-only genome line for the Werkstatt footer (STE-46). No knobs. */
export function formatColonyParams(params: AcoParams): string {
  return `α ${formatParamNumber(params.alpha)} · β ${formatParamNumber(params.beta)} · ρ ${formatParamNumber(params.rho)} · Q ${formatParamNumber(params.q)} · τ₀ ${formatParamNumber(params.tau0)} · ${params.antCount} Ameisen`;
}

function formatParamNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  // Keep short decimals (ρ 0.45) without trailing noise from binary floats.
  return String(Number(value.toPrecision(6)));
}
