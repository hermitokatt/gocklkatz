# Why there is no acquisition path in this app

Root `AGENTS.md` §4 points readers here for the decision that browser drivers and scraping
frameworks are out of the shipped demo. This note records that decision honestly.

## What this demo is about

Arbeitsmarkt is a portfolio exhibit of a **job-listing pipeline**: filter and rank listings
against a profile, honour request budgets and retention, surface source health and alarms. The
interesting engineering is that compliance surface.

Several sources such a pipeline can read have terms that prohibit automated collection or
republication. Publishing scraped listings (or the personal profile they are ranked against) is
out of scope for this public repository.

## What was rejected for the shipped app

| Option                                                                                       | Why it is not in this tree                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install Playwright / Puppeteer / a scraping framework in `dependencies` or `devDependencies` | The demo must not acquire third-party listings at all. A browser driver in the app runtime is unnecessary for rendering a committed synthetic dataset, and would invite a “just scrape once for the demo” path. |
| `fetch` live APIs at build or runtime, with a synthetic fallback                             | A silent fallback is a defect. A `try`/`catch` around live collection passes CI offline while still shipping an acquisition path into a public demo. The app acquires nothing.                                  |
| Commit scraped fixtures “for illustration”                                                   | Third-party listings and candidate profiles must not be committed or published.                                                                                                                                 |

No separate performance benchmark of browser drivers was run for this ticket. They are rejected
because they are not needed for a synthetic exhibit, and because installing them would put an
acquisition tool into a repository whose rule is that no acquisition happens here.

## What a deployment of the real pipeline would do instead

In a private deployment of the pipeline (outside this public demo):

- collection would run on a schedule or operator trigger against allowlisted sources;
- robots and request-budget rules would gate each source;
- raw pages and digests would stay in private storage with a retention window;
- alarms would fire on source health and budget breaches;
- **none of that harvested data would be published to this repository or to this Vercel demo.**

This app’s deploy serves only the committed synthetic dataset generated from seed `28`. Build,
test, and runtime require no network access to listing sources.
