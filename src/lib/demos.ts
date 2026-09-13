import { z } from "zod";

/**
 * The two states a demo can be in. `live` means the deployment has been fetched and answered;
 * `in-development` means there is nothing to link to yet.
 */
export const demoStatusSchema = z.enum(["live", "in-development"]);

export type DemoStatus = z.infer<typeof demoStatusSchema>;

/**
 * One measured claim per demo, with where it comes from and how to reproduce it.
 *
 * `AGENTS.md` §4 forbids publishing a number without provenance, so the three fields are structural
 * rather than optional: a claim cannot be recorded without saying which file it came from and which
 * command re-derives it. The card renders the claim text; the source path and command stay in this
 * module (and in `docs/CLAIM_AUDIT.md`) rather than as a row on the card.
 */
export const claimSchema = z.object({
  /** The claim itself. `demo-card.tsx` renders it, and scripts/verify.sh asserts it in the HTML. */
  text: z.string().min(1),
  /** Repository-relative path to the file the claim comes from, not from memory. */
  source: z.string().regex(/^[A-Za-z0-9._/-]+$/, "claim source must be a repository-relative path"),
  /** The command that reproduces the measurement. */
  command: z.string().min(1),
});

export type Claim = z.infer<typeof claimSchema>;

export const demoSchema = z.object({
  /** Stable identifier. It is the card's `data-demo` attribute, which scripts/verify.sh reads. */
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  /** Where the demo lives once it is deployed. Rendered as a link only while status is `live`. */
  url: z.url(),
  status: demoStatusSchema,
  claim: claimSchema,
});

export type Demo = z.infer<typeof demoSchema>;

export const demoListSchema = z.array(demoSchema).nonempty();

/**
 * The portfolio. Adding a demo is one entry here; the card component renders whatever this
 * list contains.
 *
 * A demo goes live by changing its `status` to `live` — and nothing else. The URL is already
 * recorded, so there is no second edit to forget, and `in-development` is the state in which
 * the card deliberately renders no link at all.
 */
const DEMOS = [
  {
    slug: "ameisenwerkstatt",
    name: "Ameisenwerkstatt",
    description: "Ant colony optimization on a fixed TSP, with a live 3D workspace.",
    url: "https://gocklkatz-ameisenwerkstatt.vercel.app",
    status: "live",
    claim: {
      text: "62 tests over its simulation, HTTP façade and tool allowlist, all passing",
      source: "apps/ameisenwerkstatt/tests/ameisen.test.ts",
      command: "npm run test",
    },
  },
  {
    slug: "bienenstock",
    name: "Bienenstock",
    description: "Bee colony simulation — hive and foraging, rendered in 3D.",
    url: "https://gocklkatz-bienenstock.vercel.app",
    status: "live",
    claim: {
      text: "13 tests over the colony model, its interactions and the canvas sizing, all passing",
      source: "apps/bienenstock/tests/colony.test.ts",
      command: "npm run test",
    },
  },
  {
    slug: "simplified",
    name: "Simplified",
    description: "Learning and practising simplified Chinese characters.",
    url: "https://gocklkatz-simplified.vercel.app",
    status: "live",
    claim: {
      text: "29 tests over the radicals data, practice sessions and health shape, all passing",
      source: "apps/simplified/tests/radicals.test.ts",
      command: "npm run test",
    },
  },
  {
    slug: "arbeitsmarkt",
    name: "Arbeitsmarkt",
    description: "A relevance-ranked job-listing pipeline, demonstrated on synthetic data.",
    url: "https://gocklkatz-arbeitsmarkt.vercel.app",
    status: "live",
    claim: {
      text: "23 tests over the synthetic dataset generator, the ranking pipeline and the operations model, all passing",
      source: "apps/arbeitsmarkt/tests/dataset.test.ts",
      command: "npm run test",
    },
  },
] as const satisfies readonly Demo[];

/**
 * Validated at module load rather than only at compile time: a hand-edited status that is
 * neither `live` nor `in-development` must stop the page, not render a card whose link
 * behaviour is undefined.
 */
export const demos: readonly Demo[] = demoListSchema.parse(DEMOS);

/** True when the card for this demo must render an anchor. */
export function hasDeployment(demo: Demo): boolean {
  return demo.status === "live";
}

export const statusLabels: Readonly<Record<DemoStatus, string>> = {
  live: "Live",
  "in-development": "In development",
};

export const deploymentLabels: Readonly<Record<DemoStatus, string>> = {
  live: "Open the demo",
  "in-development": "Not yet deployed",
};
