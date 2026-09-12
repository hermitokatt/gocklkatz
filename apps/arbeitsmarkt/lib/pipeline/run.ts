/**
 * Pure ranking pipeline: collect → filter → rank → digest.
 *
 * Imports nothing from three, touches no DOM, and reads no clock or environment.
 * Given the same dataset and profile, the output is byte-stable for a given serialization.
 */

import { z } from "zod";
import type { ListingRecord, SyntheticDataset } from "@/lib/dataset";

export const SCORE_COMPONENT_IDS = [
  "role_match",
  "focus_match",
  "location_match",
  "recency",
] as const;

export type ScoreComponentId = (typeof SCORE_COMPONENT_IDS)[number];

export const candidateProfileSchema = z.object({
  id: z.string().min(1),
  synthetic: z.literal(true),
  label: z.string().min(1),
  statement: z.string().min(1),
  preferredRoles: z.array(z.string().min(1)).min(1),
  preferredFocus: z.array(z.string().min(1)).min(1),
  preferredDistricts: z.array(z.string().min(1)).min(1),
  eligibility: z.object({
    postedOnOrAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    excludedFocus: z.array(z.string().min(1)),
    excludedRoles: z.array(z.string().min(1)),
  }),
  scoring: z.object({
    weights: z.object({
      role_match: z.number().nonnegative(),
      focus_match: z.number().nonnegative(),
      location_match: z.number().nonnegative(),
      recency: z.number().nonnegative(),
    }),
    recencyAnchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    recencyHalfLifeDays: z.number().positive(),
  }),
  digestSize: z.number().int().positive(),
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;

export type FilterReasonCode = "posted_before_eligibility" | "focus_excluded" | "role_excluded";

export type RejectedListing = {
  record: ListingRecord;
  reasonCode: FilterReasonCode;
  reason: string;
};

export type ScoreBreakdown = {
  components: Record<ScoreComponentId, number>;
  weighted: Record<ScoreComponentId, number>;
  total: number;
};

export type RankedListing = {
  record: ListingRecord;
  rank: number;
  score: ScoreBreakdown;
};

export type PipelineStageId = "collect" | "filter" | "rank" | "digest";

export type PipelineStage = {
  id: PipelineStageId;
  label: string;
  count: number;
};

export type PipelineResult = {
  stages: PipelineStage[];
  rejected: RejectedListing[];
  ranked: RankedListing[];
  digest: RankedListing[];
  profile: CandidateProfile;
};

/** Title format from the generator: `"Role · focus"`. */
export function parseTitle(title: string): { role: string; focus: string } {
  const sep = " · ";
  const idx = title.indexOf(sep);
  if (idx < 0) {
    return { role: title, focus: "" };
  }
  return {
    role: title.slice(0, idx),
    focus: title.slice(idx + sep.length),
  };
}

/** District token is the first whitespace-separated word of the location. */
export function parseDistrict(location: string): string {
  const space = location.indexOf(" ");
  return space < 0 ? location : location.slice(0, space);
}

/**
 * Whole days between two ISO dates (UTC calendar days).
 * Built from fixed date parts — does not read the wall clock.
 */
export function daysBetweenIso(earlier: string, later: string): number {
  const [ey, em, ed] = earlier.split("-").map(Number) as [number, number, number];
  const [ly, lm, ld] = later.split("-").map(Number) as [number, number, number];
  const ms = Date.UTC(ly, lm - 1, ld) - Date.UTC(ey, em - 1, ed);
  return Math.round(ms / 86_400_000);
}

/**
 * Filter stage: remove ineligible listings. First matching rule wins.
 * Rejected rows always carry a visible reason.
 */
export function filterListings(
  records: readonly ListingRecord[],
  profile: CandidateProfile,
): { eligible: ListingRecord[]; rejected: RejectedListing[] } {
  const eligible: ListingRecord[] = [];
  const rejected: RejectedListing[] = [];

  for (const record of records) {
    const { role, focus } = parseTitle(record.title);

    if (record.postedOn < profile.eligibility.postedOnOrAfter) {
      rejected.push({
        record,
        reasonCode: "posted_before_eligibility",
        reason: `Posted ${record.postedOn}, before eligibility cutoff ${profile.eligibility.postedOnOrAfter}.`,
      });
      continue;
    }

    if (profile.eligibility.excludedFocus.includes(focus)) {
      rejected.push({
        record,
        reasonCode: "focus_excluded",
        reason: `Focus "${focus}" is excluded by the demonstration profile.`,
      });
      continue;
    }

    if (profile.eligibility.excludedRoles.includes(role)) {
      rejected.push({
        record,
        reasonCode: "role_excluded",
        reason: `Role "${role}" is excluded by the demonstration profile.`,
      });
      continue;
    }

    eligible.push(record);
  }

  return { eligible, rejected };
}

/** Score one listing against the profile. Component values are in [0, 1]; total is the weighted sum. */
export function scoreListing(record: ListingRecord, profile: CandidateProfile): ScoreBreakdown {
  const { role, focus } = parseTitle(record.title);
  const district = parseDistrict(record.location);
  const { weights, recencyAnchor, recencyHalfLifeDays } = profile.scoring;

  const role_match = profile.preferredRoles.includes(role) ? 1 : 0;
  const focus_match = profile.preferredFocus.includes(focus) ? 1 : 0;
  const location_match = profile.preferredDistricts.includes(district) ? 1 : 0;

  const daysAgo = Math.max(0, daysBetweenIso(record.postedOn, recencyAnchor));
  const recency = Math.pow(0.5, daysAgo / recencyHalfLifeDays);

  const components: Record<ScoreComponentId, number> = {
    role_match,
    focus_match,
    location_match,
    recency,
  };

  const weighted: Record<ScoreComponentId, number> = {
    role_match: round6(weights.role_match * role_match),
    focus_match: round6(weights.focus_match * focus_match),
    location_match: round6(weights.location_match * location_match),
    recency: round6(weights.recency * recency),
  };

  const total = round6(
    weighted.role_match + weighted.focus_match + weighted.location_match + weighted.recency,
  );

  return { components, weighted, total };
}

/**
 * Rank stage: score survivors, sort by descending total, then by id ascending for ties.
 */
export function rankListings(
  records: readonly ListingRecord[],
  profile: CandidateProfile,
): RankedListing[] {
  const scored = records.map((record) => ({
    record,
    score: scoreListing(record, profile),
  }));

  scored.sort((a, b) => {
    if (b.score.total !== a.score.total) {
      return b.score.total - a.score.total;
    }
    return a.record.id.localeCompare(b.record.id);
  });

  return scored.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

/**
 * Run the full pipeline over a dataset and profile.
 * Stages are visible as collect → filter → rank → digest.
 */
export function runPipeline(dataset: SyntheticDataset, profile: CandidateProfile): PipelineResult {
  const collected = dataset.records;
  const { eligible, rejected } = filterListings(collected, profile);
  const ranked = rankListings(eligible, profile);
  const digest = ranked.slice(0, profile.digestSize);

  const stages: PipelineStage[] = [
    { id: "collect", label: "Collect", count: collected.length },
    { id: "filter", label: "Filter", count: eligible.length },
    { id: "rank", label: "Rank", count: ranked.length },
    { id: "digest", label: "Digest", count: digest.length },
  ];

  return { stages, rejected, ranked, digest, profile };
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
