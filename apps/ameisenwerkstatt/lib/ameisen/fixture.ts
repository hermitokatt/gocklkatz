import { z } from "zod";
import type { City } from "./types";

export const citySchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
});

export const tspFixtureSchema = z.array(citySchema).min(5);

/**
 * Fixed TSP fixture (≥5 cities). Coordinates are factory-floor units used by
 * the Euclidean ACO distance matrix. The Werkstatt canvas places the same
 * cities on a Fibonacci sphere for display only (STE-54) — sphere positions
 * are not the metric source.
 *
 * Default: five workshop stations (pour → hearth → press → dock → gate).
 */
const RAW_AMEISEN_TSP: City[] = [
  { id: 0, name: "Guss", x: 80, y: 420 },
  { id: 1, name: "Herd", x: 210, y: 70 },
  { id: 2, name: "Presse", x: 430, y: 160 },
  { id: 3, name: "Dock", x: 540, y: 520 },
  { id: 4, name: "Tor", x: 140, y: 560 },
];

export function parseTspFixture(raw: unknown): City[] {
  const cities = tspFixtureSchema.parse(raw);
  const ids = cities.map((city) => city.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("TSP fixture city ids must be unique");
  }
  return cities;
}

export const AMEISEN_TSP_FIXTURE: City[] = parseTspFixture(RAW_AMEISEN_TSP);
