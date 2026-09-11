import { describe, expect, it } from "vitest";
import { fibonacciSphereLayout, fibonacciSpherePoint } from "@/lib/ameisen";

function assertOnSphere(
  points: { x: number; y: number; z: number }[],
  radius: number,
  eps = 1e-12,
): void {
  for (const p of points) {
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(radius, 10);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(Number.isFinite(p.z)).toBe(true);
  }
  // Distinct positions for typical N (no accidental duplicates).
  const keys = new Set(points.map((p) => `${p.x.toFixed(8)}:${p.y.toFixed(8)}:${p.z.toFixed(8)}`));
  expect(keys.size).toBe(points.length);
  void eps;
}

describe("fibonacciSphereLayout (N-agnostic)", () => {
  it("places n=5 points on a unit sphere via the golden-spiral formulas", () => {
    const n = 5;
    const points = fibonacciSphereLayout(n);
    expect(points).toHaveLength(n);
    assertOnSphere(points, 1);

    // Spot-check index 0 against the ticket formulas.
    const y = 1 - (2 * (0 + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = 0 * Math.PI * (3 - Math.sqrt(5));
    const expected = fibonacciSpherePoint(0, n);
    expect(expected.y).toBeCloseTo(y, 12);
    expect(expected.x).toBeCloseTo(Math.cos(theta) * r, 12);
    expect(expected.z).toBeCloseTo(Math.sin(theta) * r, 12);
    expect(points[0]).toEqual(expected);
  });

  it("places n=8 points on a scaled sphere without hard-coding N", () => {
    const n = 8;
    const radius = 2.5;
    const points = fibonacciSphereLayout(n, radius);
    expect(points).toHaveLength(n);
    assertOnSphere(points, radius);

    for (let i = 0; i < n; i++) {
      expect(points[i]).toEqual(fibonacciSpherePoint(i, n, radius));
    }
  });

  it("rejects invalid n / i / radius", () => {
    expect(() => fibonacciSpherePoint(0, 0)).toThrow();
    expect(() => fibonacciSpherePoint(-1, 5)).toThrow();
    expect(() => fibonacciSpherePoint(5, 5)).toThrow();
    expect(() => fibonacciSpherePoint(0, 5, -1)).toThrow();
  });
});
