import committedListings from "@/data/listings.json";
import { datasetSchema, type SyntheticDataset, generateDataset, DEFAULT_SEED } from "./generate";

/**
 * Load the committed synthetic dataset. Generation happens offline from the seed; this module
 * only reads the checked-in file. There is no network path and no fallback to live listings.
 */
export function loadCommittedDataset(): SyntheticDataset {
  return datasetSchema.parse(committedListings);
}

/** Dataset used by the app at runtime — always the committed file, never a live fetch. */
export function getDataset(): SyntheticDataset {
  return loadCommittedDataset();
}

/** Re-generate from the default seed (tests / regeneration only). */
export function regenerateDefault(): SyntheticDataset {
  return generateDataset(DEFAULT_SEED);
}

export type { SyntheticDataset, ListingRecord } from "./generate";
export {
  generateDataset,
  serializeDataset,
  syntheticOnly,
  DEFAULT_SEED,
  SYNTHETIC_STATEMENT,
  datasetSchema,
} from "./generate";
