import { z } from "zod";

/**
 * The two states a demo can be in. `live` means the deployment has been fetched and answered;
 * `in-development` means there is nothing to link to yet.
 */
export const demoStatusSchema = z.enum(["live", "in-development"]);

export type DemoStatus = z.infer<typeof demoStatusSchema>;

export const demoSchema = z.object({
  /** Stable identifier. It is the card's `data-demo` attribute, which scripts/verify.sh reads. */
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  /** Where the demo lives once it is deployed. Rendered as a link only while status is `live`. */
  url: z.url(),
  status: demoStatusSchema,
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
  },
  {
    slug: "bienenstock",
    name: "Bienenstock",
    description: "Bee colony simulation — hive and foraging, rendered in 3D.",
    url: "https://gocklkatz-bienenstock.vercel.app",
    status: "in-development",
  },
  {
    slug: "simplified",
    name: "Simplified",
    description: "Learning and practising simplified Chinese characters.",
    url: "https://gocklkatz-simplified.vercel.app",
    status: "in-development",
  },
  {
    slug: "arbeitsmarkt",
    name: "Arbeitsmarkt",
    description: "Relevance-ranked IT job listings from public APIs.",
    url: "https://gocklkatz-arbeitsmarkt.vercel.app",
    status: "in-development",
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
