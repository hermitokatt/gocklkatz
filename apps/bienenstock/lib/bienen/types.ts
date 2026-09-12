import type { ColonyParams } from "./params";
import type { Rng } from "./rng";

export type BeeState = "inHive" | "outbound" | "foraging" | "returning" | "fleeing";

export type Bee = {
  id: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  state: BeeState;
  patchId: number | null;
  carried: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  progress: number;
  cruiseAlt: number;
  phase: number;
  wanderAmp: number;
  rest: number;
  lastPatchId: number | null;
  lastQuality: number;
};

export type Patch = {
  id: number;
  x: number;
  z: number;
  richness: number;
  nectar: number;
  initialNectar: number;
  advertisement: number;
  visits: number;
  collected: number;
};

export type Hive = {
  x: number;
  y: number;
  z: number;
  nectar: number;
};

export type Colony = {
  time: number;
  bees: Bee[];
  patches: Patch[];
  hive: Hive;
  params: ColonyParams;
  rng: Rng;
};

/** Plain data a test can stringify. Excludes the RNG function. */
export type ColonySnapshot = {
  time: number;
  hiveNectar: number;
  patches: Array<{
    id: number;
    nectar: number;
    advertisement: number;
    visits: number;
    collected: number;
  }>;
  bees: Array<{
    id: number;
    x: number;
    y: number;
    z: number;
    heading: number;
    state: BeeState;
    patchId: number | null;
    carried: number;
    progress: number;
    rest: number;
    lastPatchId: number | null;
    lastQuality: number;
  }>;
};
