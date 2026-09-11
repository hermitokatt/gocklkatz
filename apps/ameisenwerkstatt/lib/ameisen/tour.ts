/** Closed-tour length: sum of consecutive edges plus return to start. */
export function tourLength(tour: readonly number[], distances: number[][]): number {
  if (tour.length < 2) {
    return 0;
  }
  let length = 0;
  for (let i = 0; i < tour.length; i++) {
    const from = tour[i]!;
    const to = tour[(i + 1) % tour.length]!;
    const edge = distances[from]?.[to];
    if (edge === undefined) {
      throw new Error(`missing distance for edge ${from}→${to}`);
    }
    length += edge;
  }
  return length;
}

export function isCompleteTour(tour: readonly number[], cityCount: number): boolean {
  if (tour.length !== cityCount) {
    return false;
  }
  const seen = new Set(tour);
  if (seen.size !== cityCount) {
    return false;
  }
  for (let i = 0; i < cityCount; i++) {
    if (!seen.has(i)) {
      return false;
    }
  }
  return true;
}
