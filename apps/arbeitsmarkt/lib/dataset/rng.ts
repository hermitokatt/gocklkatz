export type Rng = () => number;

/**
 * Mulberry32 — same deterministic [0, 1) generator as apps/bienenstock.
 * The dataset must be reproducible from a seed; the platform PRNG is forbidden here.
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

/** Inclusive integer in [lo, hi]. */
export function randInt(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, 0, items.length - 1)]!;
}
