export function cloneMatrix(matrix: number[][]): number[][] {
  return matrix.map((row) => row.slice());
}
