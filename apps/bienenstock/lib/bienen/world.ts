/**
 * Static stage: hive entrance and flower-patch centres. The renderer plants vegetation here;
 * the colony simulates foraging against the same coordinates. Neither file owns the other.
 */

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type FlowerPatchSpec = {
  id: number;
  x: number;
  z: number;
  /** Relative nectar quality. Higher means faster collecting and stronger advertisements. */
  richness: number;
  initialNectar: number;
};

/** Matches the woven-skep entrance mesh in the scene. */
export const HIVE_ENTRANCE: Vec3 = { x: 0, y: 0.42, z: 1.28 };

/**
 * Six meadow patches. Patch 4 is distinctly richer so a colony run is expected to concentrate
 * there rather than spread uniformly.
 */
export const FLOWER_PATCHES: readonly FlowerPatchSpec[] = [
  { id: 0, x: 4.5, z: 3.2, richness: 1.0, initialNectar: 48 },
  { id: 1, x: -5.2, z: 2.4, richness: 0.65, initialNectar: 32 },
  { id: 2, x: 3.8, z: -5.5, richness: 0.9, initialNectar: 42 },
  { id: 3, x: -4.0, z: -4.8, richness: 0.55, initialNectar: 28 },
  { id: 4, x: 7.5, z: -1.2, richness: 1.8, initialNectar: 72 },
  { id: 5, x: -7.0, z: 5.5, richness: 0.4, initialNectar: 22 },
];

/** Seed for the scenery generator only (grass / flowers / trees). Not the colony seed. */
export const SCENERY_SEED = 0xbee5;
