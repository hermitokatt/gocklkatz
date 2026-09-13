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
  /**
   * The portfolio intro. Ticket GOC-12 asks for one short paragraph saying what these projects are
   * and what connects them, and for it to be specific rather than a greeting — so it leads with the
   * through-line and states only what is true of all four demos:
   *
   *   - each is a complete application, not a snippet;
   *   - each is independently built, tested and deployed;
   *   - each is verified by running it, which is the rule in `AGENTS.md` §7.
   *
   * `scripts/probe.mjs` asserts this text is in the served HTML and that it makes no claim the
   * cards themselves would contradict.
   */
  intro:
    "Four demo applications, each a complete build rather than a sketch: its own dependencies, " +
    "its own tests, its own quality gate, its own Vercel project. What connects them is how they " +
    "are made — every project here is built, tested and deployed on its own, and verified by " +
    "running it rather than by trusting a green build.",
  repositoryUrl: "https://github.com/hermitokatt/gocklkatz",
  repositoryLabel: "github.com/hermitokatt/gocklkatz",
  license: "MIT",
  copyrightYear: 2026,
} as const;
