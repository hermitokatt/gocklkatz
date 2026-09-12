export type Rng = () => number;

/**
 * Mulberry32 — the same generator the outdoor scene already used for grass, flowers, and trees.
 * Deterministic [0, 1). The simulation and the scenery each get their own instance so a draw
 * added to one stream cannot reorder the other.
 */
export function createRng(seed: number): Rng {
  const state = { s: seed >>> 0 };
  return () => {
    let t = (state.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
