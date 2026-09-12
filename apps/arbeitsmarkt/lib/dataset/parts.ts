/**
 * Checked-in word parts for synthetic employer and location names.
 *
 * Construction rule (also recorded in the dataset legend):
 *   companyName = "SYN-" + Prefix + Middle + Suffix
 *
 * Every part is an invented stem. None is a real employer trademark. The "SYN-" prefix makes
 * artificiality visible even when a reader skims a single field.
 */

export type NamePart = {
  readonly token: string;
  /** Plain-language meaning so the legend is self-evident, not asserted. */
  readonly meaning: string;
};

export const PREFIXES: readonly NamePart[] = [
  { token: "Vex", meaning: "invented stem — no real employer" },
  { token: "Quor", meaning: "invented stem — no real employer" },
  { token: "Nex", meaning: "invented stem — no real employer" },
  { token: "Zim", meaning: "invented stem — no real employer" },
  { token: "Prax", meaning: "invented stem — no real employer" },
  { token: "Flux", meaning: "invented stem — no real employer" },
  { token: "Glyp", meaning: "invented stem — no real employer" },
  { token: "Korr", meaning: "invented stem — no real employer" },
] as const;

export const MIDDLES: readonly NamePart[] = [
  { token: "alyn", meaning: "invented bridge syllable" },
  { token: "umir", meaning: "invented bridge syllable" },
  { token: "orith", meaning: "invented bridge syllable" },
  { token: "ixan", meaning: "invented bridge syllable" },
  { token: "ynor", meaning: "invented bridge syllable" },
  { token: "etho", meaning: "invented bridge syllable" },
] as const;

export const SUFFIXES: readonly NamePart[] = [
  { token: "Tek", meaning: "invented suffix — not a product brand" },
  { token: "Labs", meaning: "invented suffix — not a product brand" },
  { token: "Works", meaning: "invented suffix — not a product brand" },
  { token: "Forge", meaning: "invented suffix — not a product brand" },
  { token: "Stack", meaning: "invented suffix — not a product brand" },
  { token: "Node", meaning: "invented suffix — not a product brand" },
] as const;

/** Fictional districts only — never a real city that could read as a vacancy. */
export const LOCATION_DISTRICTS: readonly NamePart[] = [
  { token: "Northgrid", meaning: "fictional district" },
  { token: "Bayloop", meaning: "fictional district" },
  { token: "Ridgevoid", meaning: "fictional district" },
  { token: "Saltspan", meaning: "fictional district" },
  { token: "Mossreach", meaning: "fictional district" },
  { token: "Ironmere", meaning: "fictional district" },
] as const;

export const LOCATION_ZONES: readonly NamePart[] = [
  { token: "Sector", meaning: "fictional zone label" },
  { token: "Commons", meaning: "fictional zone label" },
  { token: "Hub", meaning: "fictional zone label" },
  { token: "Yard", meaning: "fictional zone label" },
] as const;

export const TITLE_ROLES: readonly string[] = [
  "Platform engineer",
  "Reliability engineer",
  "Data pipeline engineer",
  "API services engineer",
  "Frontend systems engineer",
  "Infrastructure engineer",
] as const;

export const TITLE_FOCUS: readonly string[] = [
  "ingestion budgets",
  "ranking stages",
  "retention windows",
  "source health",
  "digest assembly",
  "alarm routing",
] as const;

/** Fixed calendar window — not derived from the wall clock. */
export const DATE_WINDOW = {
  startInclusive: "2024-01-01",
  endInclusive: "2024-06-30",
  /** Day count inclusive of both ends (182 days in this leap-year half). */
  dayCountInclusive: 182,
} as const;

export const SCHEMA_VERSION = 1;
export const DEFAULT_SEED = 28;
export const RECORD_COUNT = 24;

export const SYNTHETIC_STATEMENT =
  "All records in this dataset are synthetic. They were generated from a checked-in seed for demonstration. No real job listing, employer, or candidate profile is present.";
