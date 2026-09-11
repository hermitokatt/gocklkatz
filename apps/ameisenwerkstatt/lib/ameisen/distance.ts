import type { City } from "./types";

export function euclidean(a: City, b: City): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function distanceMatrix(cities: readonly City[]): number[][] {
  const n = cities.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = euclidean(cities[i]!, cities[j]!);
      matrix[i]![j] = d;
      matrix[j]![i] = d;
    }
  }
  return matrix;
}

export function heuristicMatrix(distances: number[][]): number[][] {
  return distances.map((row, i) =>
    row.map((d, j) => {
      if (i === j || d <= 0) {
        return 0;
      }
      return 1 / d;
    }),
  );
}
