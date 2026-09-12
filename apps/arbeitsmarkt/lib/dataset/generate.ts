import { z } from "zod";
import {
  DATE_WINDOW,
  DEFAULT_SEED,
  MIDDLES,
  PREFIXES,
  RECORD_COUNT,
  SCHEMA_VERSION,
  SUFFIXES,
  SYNTHETIC_STATEMENT,
  TITLE_FOCUS,
  TITLE_ROLES,
  LOCATION_DISTRICTS,
  LOCATION_ZONES,
} from "./parts";
import { createRng, pick, randInt } from "./rng";

export const companyPartsSchema = z.object({
  prefix: z.string().min(1),
  middle: z.string().min(1),
  suffix: z.string().min(1),
});

export const listingRecordSchema = z.object({
  id: z.string().regex(/^syn-\d{4}$/),
  /** Structural synthetic flag — a consumer cannot select a record without carrying it. */
  synthetic: z.literal(true),
  companyName: z.string().regex(/^SYN-[A-Za-z]+$/),
  companyParts: companyPartsSchema,
  title: z.string().min(1),
  location: z.string().min(1),
  postedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const namePartSchema = z.object({
  token: z.string().min(1),
  meaning: z.string().min(1),
});

export const datasetLegendSchema = z.object({
  construction: z.literal(
    "companyName = 'SYN-' + Prefix + Middle + Suffix; location = District + ' ' + Zone",
  ),
  prefixes: z.array(namePartSchema).min(1),
  middles: z.array(namePartSchema).min(1),
  suffixes: z.array(namePartSchema).min(1),
  locationDistricts: z.array(namePartSchema).min(1),
  locationZones: z.array(namePartSchema).min(1),
});

export const datasetMetaSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  seed: z.number().int(),
  synthetic: z.literal(true),
  statement: z.literal(SYNTHETIC_STATEMENT),
  dateWindow: z.object({
    startInclusive: z.literal(DATE_WINDOW.startInclusive),
    endInclusive: z.literal(DATE_WINDOW.endInclusive),
    dayCountInclusive: z.literal(DATE_WINDOW.dayCountInclusive),
  }),
  // Number must match records.length (refined on the dataset). The generator still writes
  // RECORD_COUNT; the literal was dropped so an emptied file can reach the digest-entry
  // assertion in verify.sh instead of failing only at Zod parse.
  recordCount: z.number().int().nonnegative(),
});

export const datasetSchema = z
  .object({
    meta: datasetMetaSchema,
    legend: datasetLegendSchema,
    records: z.array(listingRecordSchema),
  })
  .superRefine((data, ctx) => {
    if (data.meta.recordCount !== data.records.length) {
      ctx.addIssue({
        code: "custom",
        message: `meta.recordCount (${data.meta.recordCount}) must equal records.length (${data.records.length})`,
        path: ["meta", "recordCount"],
      });
    }
  });

export type ListingRecord = z.infer<typeof listingRecordSchema>;
export type SyntheticDataset = z.infer<typeof datasetSchema>;

function dayOffsetToIso(offset: number): string {
  // Anchor at 2024-01-01 UTC midnight; offsets stay inside the fixed window.
  const ms = Date.UTC(2024, 0, 1 + offset);
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildCompanyName(prefix: string, middle: string, suffix: string): string {
  return `SYN-${prefix}${middle}${suffix}`;
}

/**
 * Produce a full synthetic dataset from a numeric seed.
 * Same seed → same bytes when serialized with {@link serializeDataset}.
 * Does not read the clock, the environment, or the network.
 */
export function generateDataset(seed: number = DEFAULT_SEED): SyntheticDataset {
  const rng = createRng(seed);
  const records: ListingRecord[] = [];

  for (let i = 0; i < RECORD_COUNT; i++) {
    const prefix = pick(rng, PREFIXES);
    const middle = pick(rng, MIDDLES);
    const suffix = pick(rng, SUFFIXES);
    const district = pick(rng, LOCATION_DISTRICTS);
    const zone = pick(rng, LOCATION_ZONES);
    const role = pick(rng, TITLE_ROLES);
    const focus = pick(rng, TITLE_FOCUS);
    const dayOffset = randInt(rng, 0, DATE_WINDOW.dayCountInclusive - 1);

    records.push({
      id: `syn-${String(i + 1).padStart(4, "0")}`,
      synthetic: true,
      companyName: buildCompanyName(prefix.token, middle.token, suffix.token),
      companyParts: {
        prefix: prefix.token,
        middle: middle.token,
        suffix: suffix.token,
      },
      title: `${role} · ${focus}`,
      location: `${district.token} ${zone.token}`,
      postedOn: dayOffsetToIso(dayOffset),
    });
  }

  const dataset: SyntheticDataset = {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      seed,
      synthetic: true,
      statement: SYNTHETIC_STATEMENT,
      dateWindow: {
        startInclusive: DATE_WINDOW.startInclusive,
        endInclusive: DATE_WINDOW.endInclusive,
        dayCountInclusive: DATE_WINDOW.dayCountInclusive,
      },
      recordCount: RECORD_COUNT,
    },
    legend: {
      construction:
        "companyName = 'SYN-' + Prefix + Middle + Suffix; location = District + ' ' + Zone",
      prefixes: PREFIXES.map((p) => ({ token: p.token, meaning: p.meaning })),
      middles: MIDDLES.map((p) => ({ token: p.token, meaning: p.meaning })),
      suffixes: SUFFIXES.map((p) => ({ token: p.token, meaning: p.meaning })),
      locationDistricts: LOCATION_DISTRICTS.map((p) => ({ token: p.token, meaning: p.meaning })),
      locationZones: LOCATION_ZONES.map((p) => ({ token: p.token, meaning: p.meaning })),
    },
    records,
  };

  return datasetSchema.parse(dataset);
}

/** Stable JSON serialization — sorted keys are not required; field order is fixed by construction. */
export function serializeDataset(dataset: SyntheticDataset): string {
  return `${JSON.stringify(dataset, null, 2)}\n`;
}

/** Records marked synthetic — the filter a consumer must use. */
export function syntheticOnly(records: readonly ListingRecord[]): ListingRecord[] {
  return records.filter((r) => r.synthetic === true);
}

export {
  DEFAULT_SEED,
  SCHEMA_VERSION,
  SYNTHETIC_STATEMENT,
  RECORD_COUNT,
  DATE_WINDOW,
} from "./parts";
