/** Unit / scaled 3D point for display layout (not ACO metric space). */
export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

/**
 * Fibonacci / golden-spiral lattice on a sphere (STE-54).
 * Deterministic, N-agnostic: use `n = cities.length`, never a hard-coded N.
 *
 * For i = 0..n-1 on the unit sphere, then scale by `radius`:
 *   y = 1 - 2*(i+0.5)/n
 *   r = sqrt(max(0, 1 - y*y))
 *   θ = i * π * (3 - sqrt(5))
 *   x = cos(θ)*r, z = sin(θ)*r
 */
export function fibonacciSpherePoint(i: number, n: number, radius = 1): Vec3 {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("fibonacciSpherePoint: n must be an integer ≥ 1");
  }
  if (!Number.isInteger(i) || i < 0 || i >= n) {
    throw new Error("fibonacciSpherePoint: i must be an integer in [0, n)");
  }
  if (!Number.isFinite(radius) || radius < 0) {
    throw new Error("fibonacciSpherePoint: radius must be a finite number ≥ 0");
  }

  const y = 1 - (2 * (i + 0.5)) / n;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * Math.PI * (3 - Math.sqrt(5));
  return {
    x: Math.cos(theta) * r * radius,
    y: y * radius,
    z: Math.sin(theta) * r * radius,
  };
}

/** All n Fibonacci-sphere points for a given display radius. */
export function fibonacciSphereLayout(n: number, radius = 1): Vec3[] {
  return Array.from({ length: n }, (_, i) => fibonacciSpherePoint(i, n, radius));
}
