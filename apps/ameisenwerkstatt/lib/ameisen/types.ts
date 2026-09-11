export type City = {
  id: number;
  name: string;
  x: number;
  y: number;
};

/** Classic Ant System parameters: edge weight is τ^α · η^β. */
export type AcoParams = {
  alpha: number;
  beta: number;
  rho: number;
  q: number;
  tau0: number;
  antCount: number;
};

export type Ant = {
  id: number;
  /** City indices visited so far (open tour; close with the start city for length). */
  tour: number[];
};

export type Colony = {
  cities: City[];
  distances: number[][];
  eta: number[][];
  tau: number[][];
  params: AcoParams;
  iteration: number;
  bestTour: number[] | null;
  bestLength: number;
  ants: Ant[];
  /** Undirected blocked edges as `edgeKey` ids. Ants skip these in construction. */
  blockedEdges: ReadonlySet<string>;
};

export type Rng = () => number;
