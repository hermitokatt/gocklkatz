# Legal and terms-of-service position

Published statement for the public Gocklkatz Inc portfolio repository. Checked on 2026-09-12.

## Code licence

The code in this repository is licensed under the MIT License, copyright Gocklkatz Inc. The
licence text is [`LICENSE`](../LICENSE). A reader who wants to reuse the code may do so under
those terms: keep the copyright and permission notice, and understand that the software is
provided without warranty.

Every application manifest declares the same licence (`"license": "MIT"`), matching the root
`package.json`.

## Dependency licences

Every **direct** dependency (runtime and development) is checked by `tools/audit-licences.mjs`. The
checker reads each package's licence from the manifest's committed `package-lock.json`, falling back
to the installed module's `package.json` and then to `licenses[].type`. The lockfile is the primary
source because it is what `npm ci` installs and therefore what ships, and because it is committed, so
a change to a dependency's licence is visible in the pull request that adds it. A package in neither
the lockfile nor an installed module is `UNKNOWN`, which fails — it is not a pass.

**Conclusion rule.** An identifier is compatible when, after trimming and comparing
case-insensitively, it is exactly one of: `MIT`, `MIT-0`, `ISC`, `0BSD`, `BSD-2-Clause`,
`BSD-3-Clause`, `Apache-2.0`, `Unlicense`, `CC0-1.0`, `BlueOak-1.0.0`, `Python-2.0`, `Zlib`,
`OFL-1.1`, `CC-BY-4.0`, `MPL-2.0`, `WTFPL`. Anything else, including `UNKNOWN` and any SPDX
expression that is not exactly one of those identifiers, fails the check. This allowlist is a
decision, not a default; it is not widened to make a check pass.

Generated 2026-09-12 by `node tools/audit-licences.mjs --list`:

| Package | Version | Licence | Conclusion |
| --- | --- | --- | --- |
| `@types/node` | 22.20.1, 26.4.1, 26.5.1 | MIT | compatible |
| `@types/react` | 19.2.18, 19.3.0 | MIT | compatible |
| `@types/react-dom` | 19.2.7, 19.3.0 | MIT | compatible |
| `@types/three` | 0.180.0 | MIT | compatible |
| `eslint` | 9.39.5 | MIT | compatible |
| `eslint-config-next` | 16.3.4, 16.3.5 | MIT | compatible |
| `eslint-config-prettier` | 10.1.8 | MIT | compatible |
| `next` | 16.3.4, 16.3.5 | MIT | compatible |
| `prettier` | 3.9.6 | MIT | compatible |
| `react` | 19.2.8, 19.3.0 | MIT | compatible |
| `react-dom` | 19.2.8, 19.3.0 | MIT | compatible |
| `three` | 0.180.0 | MIT | compatible |
| `typescript` | 5.9.3 | Apache-2.0 | compatible |
| `vite` | 8.2.2, 8.3.0 | MIT | compatible |
| `vitest` | 3.2.7, 5.0.0 | MIT | compatible |
| `zod` | 4.5.4, 4.6.2 | MIT | compatible |

**Needed attention.** `typescript` is the only direct dependency not under MIT. It is
`Apache-2.0`, which is on the allowlist and is compatible with public redistribution of this
repository. No direct dependency required a replacement.

Versions differ across applications because each app has its own lockfile; the licence
identifier was the same for every installed copy of a given package.

## Vendored and third-party content

### Google fonts (Literata, Syne, Noto Sans SC)

`apps/simplified/app/layout.tsx` imports `Literata`, `Noto_Sans_SC` and `Syne` from
`next/font/google`. Next.js downloads the font files at **build time** and self-hosts them with
the application's static assets. The deployed site serves the fonts from its own origin.

- **Origin:** the canonical `google/fonts` tree, each family under `ofl/`:
  - <https://github.com/google/fonts/tree/main/ofl/literata>
  - <https://github.com/google/fonts/tree/main/ofl/syne>
  - <https://github.com/google/fonts/tree/main/ofl/notosanssc>
- **Licence:** SIL Open Font License 1.1 (`OFL-1.1`) for all three.
- **Why redistribution is permitted:** OFL-1.1 allows the Font Software to be bundled and
  redistributed with any software, provided each copy contains the copyright notice and this
  licence. That obligation is met by [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md), which
  names each family, its origin, `OFL-1.1`, its upstream copyright line, and the licence text. Each
  copyright line was read from that family's own `OFL.txt` on 2026-09-12, not inferred.

### Ameisenwerkstatt design samples

`apps/ameisenwerkstatt/docs/ameisen-ui-samples/` holds five HTML frames and five matching PNG
screenshots (`sample-a-werkstatt`, `sample-a2-werkstatt-chaos`, `sample-b-leitstand`,
`sample-c-blaupause`, `sample-d-buehne`).

- **Origin:** authored in this repository. The folder README records that every number, tour,
  trail and ant position is real simulation state from `lib/ameisen` (seed 37, then-current
  defaults, a 10-city fixture), rendered into the HTML in that folder and screenshotted at
  1440×900 @2x. `docs/AMEISENFABRIK-UI.md` is the design study that refers to the same frames as
  the record of what was considered and what was rejected.
- **Licence:** MIT, with the rest of the repository (`LICENSE`).
- **Why redistribution is permitted:** the samples are original work of this project, not
  third-party artwork. The HTML files name `Inter` and `JetBrains Mono` as CSS `font-family`
  fallbacks only; they do not load webfonts, and no font file is committed. The README notes that
  the render box falls back, and that the frames are to be read for layout rather than typeface.

### Arbeitsmarkt synthetic dataset

`apps/arbeitsmarkt/data/*.json` (`listings.json`, `profile.json`, `sources.json`).

- **Origin:** generated in this repository from a checked-in numeric seed. Default seed `28`,
  generator `lib/dataset/generate.ts`, construction documented in
  [`apps/arbeitsmarkt/docs/SYNTHETIC_DATA.md`](../apps/arbeitsmarkt/docs/SYNTHETIC_DATA.md).
- **Licence:** MIT, with the rest of the repository.
- **Why redistribution is permitted:** the records are not third-party data and are not scraped.
  Company names, locations, source display names and the candidate profile are invented
  constructions (`SYN-…`, fictional districts, `SRC-…`). Every listing carries `synthetic: true`.

### Simplified radical seed

`apps/simplified/lib/radicals/seed.ts` is a curated beginner seed of characters with pinyin and
glosses.

- **Origin:** hand-authored in this repository. [`apps/simplified/docs/hanzi_research.md`](../apps/simplified/docs/hanzi_research.md)
  is the research input that informed *what* the app teaches (structure-first study, frequency,
  radicals). The seed itself was written here; see `apps/simplified/README.md` under "Data
  provenance".
- **Licence:** MIT, with the rest of the repository.
- **Why redistribution is permitted:** no scraped text is committed. Facts about the writing
  system (which components exist, how they are written and pronounced) are not owned. The
  selection, ordering, English glosses and example pairings were written for this project.
  `hanzi_research.md` is a summary with inline citations rather than copied text; it states that
  no page is reproduced and that no character data was taken from the cited sources. Passages
  read as paraphrase with sources named, not as transcribed articles.

### Fonts that are not vendored

`apps/simplified/docs/FONTS.md` is a plan for upcoming study UI, not a vendored font. The landing
page, Ameisenwerkstatt, Bienenstock and Arbeitsmarkt use system font stacks only (CSS
`font-family` names; no webfont packages).

`git ls-files` lists no tracked `woff`, `woff2`, `ttf` or `otf` file.

### Inventory check

Tracked binary assets that are not fonts are the five PNG samples named above. No other image,
font file, or third-party dataset was found outside this inventory. `apps/arbeitsmarkt/data/profile.json`
is part of the synthetic dataset already covered.

## Terms of service

### Job-listings pipeline (Arbeitsmarkt)

This is the pipeline whose compliance rules belong in this document, not only in the app's own
files. The app documents remain the detailed record:
[`ACQUISITION.md`](../apps/arbeitsmarkt/docs/ACQUISITION.md),
[`OPERATIONS.md`](../apps/arbeitsmarkt/docs/OPERATIONS.md),
[`SYNTHETIC_DATA.md`](../apps/arbeitsmarkt/docs/SYNTHETIC_DATA.md),
and the committed registry [`data/sources.json`](../apps/arbeitsmarkt/data/sources.json).

**What listing-host terms typically allow, and what this project does.** Several real listing
hosts prohibit automated collection or republication. This public repository does not collect
from them, does not commit their listings, and does not name a real job board. The shipped app
has no acquisition path: no `fetch` to listing hosts, no scraping framework, no browser driver,
and no "live with synthetic fallback" branch (`ACQUISITION.md`). Build, test and runtime require
no network access to listing sources.

**Sources in the demonstration registry** (`data/sources.json`). Display names are invented
(`SRC-` + word parts). Compliance is a field on each record, enforced by `isCollectionAllowed`
in `lib/pipeline/operations.ts` (`true` only when `complianceStatus` is `permitted`).

| Source id | Display name | Status | Why |
| --- | --- | --- | --- |
| `syn-src-0001` | SRC-VexalynFeed | **permitted** | On the demonstration allowlist. Collection may be scheduled only while `isCollectionAllowed` returns true. Five synthetic successful attempts are recorded so the operations view has a healthy source. |
| `syn-src-0002` | SRC-QuorumirIndex | **disabled** | Marked disabled in the demonstration registry so the compliance gate can be shown. `isCollectionAllowed` returns false; no attempt is recorded. A disabled source that *had* an attempt would fire the `disabled_source_collected` alarm. |
| `syn-src-0003` | SRC-NexorithLedger | **permitted** | On the demonstration allowlist. Consecutive synthetic failures (including a `refused_403`) drive derived quarantine — a permitted source can still be operationally stopped. |
| `syn-src-0004` | SRC-ZimumirRelay | **permitted** | On the demonstration allowlist. Two consecutive synthetic transport failures place it in back-off under the demonstration policy. |

There is no live collection against any of these ids. Attempt records are committed fixtures.
`quarantined` is not a static registry label; it is derived from consecutive failures on a
permitted source (`OPERATIONS.md`). Request budgets, back-off and alarms are likewise computed
from the committed registry, not from contacting a host.

A private deployment of a real pipeline would collect only from allowlisted sources, gate each
source with robots and request-budget rules, keep harvested pages in private storage with a
retention window, and **would not publish that harvested data to this repository or to this
Vercel demo** (`ACQUISITION.md`).

### Google Fonts build-time fetch

`apps/simplified` is the only application that loads Google Fonts.

**What the font licences allow.** Literata, Syne and Noto Sans SC are OFL-1.1. Bundling and
self-hosting the Font Software with a website is permitted when the copyright notice and
licence accompany the copy (see Vendored content above, and `THIRD_PARTY_NOTICES.md`).

**What the service's terms say.** The Google Fonts API is a Google API, and its own terms page says
exactly one additional thing: "By using this API, you consent to be bound by the Google APIs Terms of
Service". The font **files** are not licensed by that API — each family carries its own licence, and
for these three that is OFL-1.1.

- Google Fonts API Terms of Service, last modified 2021-11-09 — fetched 2026-09-12:
  <https://developers.google.com/fonts/terms>

**What this project does inside that boundary.** The API is used at **build time only**, by
`next/font/google`. Nothing at runtime calls it, and no font file is redistributed under the API
terms — the OFL-1.1 notice in `THIRD_PARTY_NOTICES.md` is what governs the copies.

Verified in a production build on 2026-09-12 rather than assumed:

```
$ find apps/simplified/.next \( -name '*.woff2' -o -name '*.woff' \) | wc -l
     111
$ grep -rlE "fonts\.gstatic|fonts\.googleapis" apps/simplified/.next/static
   (no output)
```

So the deployed artifact serves 111 self-hosted font files, and no built stylesheet or script
references a Google font host. **A browser opening the deployed site sends no request to Google.**

## What this repository does not do

This repository acquires nothing. It publishes no scraped content. It ships no browser driver
and no scraping framework at application runtime (`AGENTS.md` §4). Arbeitsmarkt renders a
synthetic dataset generated from a checked-in seed. Playwright is on the dependency allowlist as
`test-only` and is not installed until an app needs served-app verification; it is not a runtime
dependency of any application.
