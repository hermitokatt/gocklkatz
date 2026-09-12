import committedProfile from "@/data/profile.json";
import committedSources from "@/data/sources.json";
import { getDataset } from "@/lib/dataset";
import { candidateProfileSchema, type CandidateProfile } from "./run";
import {
  buildOperationalSnapshot,
  sourceRegistrySchema,
  type OperationalSnapshot,
  type SourceRegistry,
} from "./operations";

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

/** Load the committed synthetic source registry. */
export function loadCommittedSources(): SourceRegistry {
  return sourceRegistrySchema.parse(committedSources);
}

export function getSourceRegistry(): SourceRegistry {
  return loadCommittedSources();
}

/** Operational snapshot over the committed registry and dataset — pure, deterministic. */
export function getOperationalSnapshot(): OperationalSnapshot {
  return buildOperationalSnapshot(getSourceRegistry(), getDataset());
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

export {
  ALARM_IDS,
  FAILURE_POLICY,
  applyFailurePolicy,
  buildOperationalSnapshot,
  evaluateAlarms,
  evaluateSource,
  isCollectionAllowed,
  isFailureOutcome,
  sourceRegistrySchema,
} from "./operations";

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

export type {
  AlarmId,
  AlarmSnapshot,
  AlarmSeverity,
  AlarmState,
  AttemptOutcome,
  ComplianceStatus,
  DisplayStatus,
  FailurePolicy,
  OperationalSnapshot,
  OperationalStatus,
  RegistrySource,
  SourceAttempt,
  SourceBudget,
  SourceHealth,
  SourceRegistry,
  SourceSnapshot,
} from "./operations";
