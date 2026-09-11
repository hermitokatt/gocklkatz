/**
 * Copy and links for the landing page. The repository link is published here, so it is one of
 * the URLs scripts/verify.sh fetches: an unreachable link on the portfolio home is a defect.
 */
export const site = {
  company: "Gocklkatz Inc",
  title: "Gocklkatz Inc — engineering portfolio",
  headline: "Four demo applications, each one deployed and running on its own.",
  description:
    "An engineering portfolio: a small number of complete applications, built end to end, " +
    "each with its own build, its own tests and its own deployment.",
  intro:
    "Every demo below is a self-contained application with its own dependencies, quality gate " +
    "and Vercel project, so one of them breaking cannot take the others down. A card links to " +
    "its deployment only once that deployment has been fetched and answered.",
  repositoryUrl: "https://github.com/hermitokatt/gocklkatz",
  repositoryLabel: "github.com/hermitokatt/gocklkatz",
  license: "MIT",
  copyrightYear: 2026,
} as const;
