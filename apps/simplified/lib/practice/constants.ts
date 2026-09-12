/**
 * Soft cap on recognition items per practice session.
 * Keeps the queue light (MVP soft session size — not SRS).
 * Chosen in the 8–12 range from docs/MVP.md / SIM-005.
 */
export const PRACTICE_SESSION_SIZE = 10;

/** Multiple-choice options per question (correct + distractors). */
export const PRACTICE_OPTION_COUNT = 4;

/** localStorage key for client-local practice progress (namespaced). */
export const PRACTICE_STORAGE_KEY = "simplified:radicals-practice";

/** Max recent answer rows retained in localStorage progress. */
export const PRACTICE_RECENT_LIMIT = 40;
