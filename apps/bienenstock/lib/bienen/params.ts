export type ColonyParams = {
  beeCount: number;
  capacity: number;
  flySpeed: number;
  collectRate: number;
  adDecay: number;
  explore: number;
};

/** Default swarm size shown on /bienen. Lower this if the measured frame rate cannot hold. */
export const DEFAULT_BEE_COUNT = 120;

export const DEFAULT_SEED = 37;

export const DEFAULT_PARAMS: ColonyParams = {
  beeCount: DEFAULT_BEE_COUNT,
  capacity: 1,
  flySpeed: 3.8,
  collectRate: 0.7,
  adDecay: 0.08,
  explore: 0.35,
};
