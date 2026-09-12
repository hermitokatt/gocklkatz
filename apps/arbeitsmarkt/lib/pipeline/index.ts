import committedProfile from "@/data/profile.json";
import { candidateProfileSchema, type CandidateProfile } from "./run";

/**
 * Load the committed synthetic candidate profile.
 * Ranking input is checked-in data, not a literal buried in a function.
 */
export function loadCommittedProfile(): CandidateProfile {
  return candidateProfileSchema.parse(committedProfile);
}

export function getProfile(): CandidateProfile {
  return loadCommittedProfile();
}

export {
  candidateProfileSchema,
  daysBetweenIso,
  filterListings,
  parseDistrict,
  parseTitle,
  rankListings,
  runPipeline,
  scoreListing,
  SCORE_COMPONENT_IDS,
} from "./run";

export type {
  CandidateProfile,
  FilterReasonCode,
  PipelineResult,
  PipelineStage,
  PipelineStageId,
  RankedListing,
  RejectedListing,
  ScoreBreakdown,
  ScoreComponentId,
} from "./run";
