# Published-claim audit

Every claim this scanner can discover from the tracked tree, with its kind and provenance. Discovery is mechanical: the four landing-page card claims in `src/lib/demos.ts`, prose counts in tracked markdown matching `NN tests` / `NN route(s)` / `NN URL(s)` / `NN application(s)` / `NN project(s)`, and (on `--write`) each application's `npm run test` count. `--check` re-runs the first two and fails if a discovered claim is absent from this file.

- **Date of audit:** 2026-09-12 (UTC date)
- **Command:** `node tools/audit-published-claims.mjs --write`
- **Kinds:** `measurement` (a number about this repository), `citation` (a number about the outside world), `parameter` (an input, not a result).

## Counts

| Kind | Count |
| --- | ---: |
| `measurement` | 17 |
| `citation` | 0 |
| `parameter` | 0 |
| **total** | **17** |

These are the rows the scanner discovers **mechanically**. Numbers it cannot reach by rule — declared `parameter`s and figures cited from outside sources — are listed by hand in the inventory further down, so a zero above does not mean there are none.

## Table

| Claim | Where | Kind | Provenance | Observed | Date | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 62 tests over its simulation, HTTP façade and tool allowlist, all passing | src/lib/demos.ts (card "ameisenwerkstatt", also the served landing page) | `measurement` | cd apps/ameisenwerkstatt && npm run test  (source apps/ameisenwerkstatt/tests/ameisen.test.ts) | 62 tests passed | 2026-09-12 | reproduced |
| 23 tests over the synthetic dataset generator, the ranking pipeline and the operations model, all passing | src/lib/demos.ts (card "arbeitsmarkt", also the served landing page) | `measurement` | cd apps/arbeitsmarkt && npm run test  (source apps/arbeitsmarkt/tests/dataset.test.ts) | 23 tests passed | 2026-09-12 | reproduced |
| 13 tests over the colony model, its interactions and the canvas sizing, all passing | src/lib/demos.ts (card "bienenstock", also the served landing page) | `measurement` | cd apps/bienenstock && npm run test  (source apps/bienenstock/tests/colony.test.ts) | 13 tests passed | 2026-09-12 | reproduced |
| 29 tests over the radicals data, practice sessions and health shape, all passing | src/lib/demos.ts (card "simplified", also the served landing page) | `measurement` | cd apps/simplified && npm run test  (source apps/simplified/tests/radicals.test.ts) | 29 tests passed | 2026-09-12 | reproduced |
| 20 route(s) | docs/DEPLOY.md | `measurement` | bash tools/verify-deployments.sh | 20 route(s) | 2026-09-12 | recorded |
| 5 URL(s) | docs/DEPLOY.md | `measurement` | bash tools/verify-live.sh | 5 URL(s) | 2026-09-12 | recorded |
| 13 tests | tools/prompts/goc-39-40-published-audits.md | `measurement` | self-test or gate documentation; see the command named on the same line | 13 tests | 2026-09-12 | recorded |
| 20 route(s) | tools/prompts/goc-39-40-published-audits.md | `measurement` | bash tools/verify-deployments.sh | 20 route(s) | 2026-09-12 | recorded |
| 23 tests | tools/prompts/goc-39-40-published-audits.md | `measurement` | self-test or gate documentation; see the command named on the same line | 23 tests | 2026-09-12 | recorded |
| 29 tests | tools/prompts/goc-39-40-published-audits.md | `measurement` | self-test or gate documentation; see the command named on the same line | 29 tests | 2026-09-12 | recorded |
| 5 URL(s) | tools/prompts/goc-39-40-published-audits.md | `measurement` | bash tools/verify-live.sh | 5 URL(s) | 2026-09-12 | recorded |
| 62 tests | tools/prompts/goc-39-40-published-audits.md | `measurement` | self-test or gate documentation; see the command named on the same line | 62 tests | 2026-09-12 | recorded |
| 62 tests | apps/ameisenwerkstatt/package.json — the count is not written in this file; it is measured by its `test` script | `measurement` | cd apps/ameisenwerkstatt && npm run test | 62 tests passed | 2026-09-12 | reproduced |
| 23 tests | apps/arbeitsmarkt/package.json — the count is not written in this file; it is measured by its `test` script | `measurement` | cd apps/arbeitsmarkt && npm run test | 23 tests passed | 2026-09-12 | reproduced |
| 13 tests | apps/bienenstock/package.json — the count is not written in this file; it is measured by its `test` script | `measurement` | cd apps/bienenstock && npm run test | 13 tests passed | 2026-09-12 | reproduced |
| 29 tests | apps/simplified/package.json — the count is not written in this file; it is measured by its `test` script | `measurement` | cd apps/simplified && npm run test | 29 tests passed | 2026-09-12 | reproduced |
| 67 tests | package.json — the count is not written in this file; it is measured by its `test` script | `measurement` | npm run test | 67 tests passed | 2026-09-12 | reproduced |

## A-2 — card claims, observed `npm run test`

<!-- BEGIN PRESERVE:a2 -->
### gocklkatz (`.`)

```
 Test Files  4 passed (4)
      Tests  67 passed (67)
```

### ameisenwerkstatt (`apps/ameisenwerkstatt`)

```
 Test Files  7 passed (7)
      Tests  62 passed (62)
```

### arbeitsmarkt (`apps/arbeitsmarkt`)

```
 Test Files  4 passed (4)
      Tests  23 passed (23)
```

### bienenstock (`apps/bienenstock`)

```
 Test Files  4 passed (4)
      Tests  13 passed (13)
```

### simplified (`apps/simplified`)

```
 Test Files  3 passed (3)
      Tests  29 passed (29)
```
<!-- END PRESERVE:a2 -->

## Findings — removed or flagged

<!-- BEGIN PRESERVE:findings -->
- **Card claims reproduced.** `cd apps/<name> && npm run test` on 2026-09-12 produced 62 / 13 / 29 / 23 passing tests, matching the four cards in `src/lib/demos.ts`. The landing page suite is 67 tests (`npm run test` at the repository root); that number is not published on a card.
- **`src/lib/demos.test.ts` does not assert the claim count against `it(` in the cited file.** It asserts the claim *shape* (`/^\d+ tests? over /`) and that the cited file contains `it(` or `test(`. The cited files are narrower than the suites: `ameisen.test.ts` has 16 `it(` against a claim of 62; `colony.test.ts` has 6 against 13; `radicals.test.ts` has 14 against 29; `dataset.test.ts` has 6 against 23. The reproducing command on each card is `npm run test` for the whole application, which is what this audit ran. The test was not changed.
- **`apps/simplified/lib/radicals/README.md` said "~30–50 beginner components".** Counted `id:` entries in `lib/radicals/seed.ts`: **45**. 45 sits inside 30–50, so this was a design envelope rather than a contradiction. The README now states the measured length, 45, with provenance `seed.ts`.
- **`docs/DEPLOY.md` byte counts and timestamps** in the quoted `verify-live.sh` / `verify-deployments.sh` output (18557 bytes, 2026-09-12T20:32:50Z, and neighbours) are labelled in that document as illustrative because they drift. They were not re-measured into a moving target.
- **`apps/ameisenwerkstatt/docs/AMEISENFABRIK-UI.md` §3** records a design-study trace against a 10-city fixture (seed 37). The live fixture is 5 cities; the document already says re-running the trace today produces different numbers. Those figures were kept as a labelled historical record, not deleted to make the audit green, and not re-measured.
- **No published card number was removed.** All four card claims reproduced.
<!-- END PRESERVE:findings -->

## Further inventory (not all mechanically discovered)

<!-- BEGIN PRESERVE:inventory -->
Numbers the prose scanner does not name, inspected on 2026-09-12.

### Parameters (declared, not reproduced)

| Claim | Where | Declaring file |
| --- | --- | --- |
| Verify ports 43123–43127 | `docs/DEPLOY.md` table, each `scripts/verify.sh`, `repo.config` | `${VERIFY_PORT:-NNNN}` in each `scripts/verify.sh`; table in `docs/DEPLOY.md` |
| Node.js Version `24.x` | `docs/DEPLOY.md` project-settings table | Vercel project setting, recorded in that document |
| Caret version ranges (`next` `^16.3.4`, `react` `^19.2.8`, …) | `docs/DEPENDENCY_ALLOWLIST.md` | that file; informational, not enforced |
| `playwright` `^1.0.0` | same allowlist | approved, not installed |
| Default seed `28`, record count `24`, schema version `1`, date window 2024-01-01…2024-06-30 | `apps/arbeitsmarkt/docs/SYNTHETIC_DATA.md`; rendered `/arbeitsmarkt` shows `recordCount` | `apps/arbeitsmarkt/lib/dataset/parts.ts` (`DEFAULT_SEED`, `RECORD_COUNT`) |
| Ranking weights 0.40 / 0.35 / 0.15 / 0.10 | `apps/arbeitsmarkt/docs/RANKING.md` | `data/profile.json` / pipeline constants |
| Operations thresholds 2, 3, 120 minutes | `apps/arbeitsmarkt/docs/OPERATIONS.md` | `data/sources.json` / operations model |
| Practice session size 10, option count 4, recent limit 40 | `apps/simplified/lib/practice/constants.ts` | that file (inputs; `docs/MVP.md` is frozen and was not edited) |
| ACO fixture: exactly 5 cities, complete graph of 10 edges | `apps/ameisenwerkstatt/docs/AMEISENFABRIK.md` | `lib/ameisen/fixture.ts` |
| Room script 5–8 minutes / ~6 minutes | `apps/ameisenwerkstatt/docs/DEMO.md` | demo script timings, not a measurement of the repository |
| Vercel `api-deployments-free-per-day` (100); two limits; five projects | `docs/DEPLOY.md` | platform limits and project count, declared in that document |
| Gate self-test **13 cases** / **8 cases** / **14 passed** | `docs/DEPLOY.md` | `bash tests/guard.test.sh`, `bash tests/gate.test.sh`, `bash tests/vercel-ignore.test.sh`. This worker re-ran the first two: guard is 13 cases (one failed here because the sandbox blocked the secret-shaped fixture); gate is 8 passed. vercel-ignore could not be reproduced in this sandbox (git hooks `Operation not permitted` in the temporary repos); the published 14 is the quoted clean run in `docs/DEPLOY.md`. |

### Citations (outside world; source URL + retrieval)

From `apps/simplified/docs/hanzi_research.md`, gathered September 2026, retrieval date of this audit 2026-09-12. Source URLs are in the link audit. Figures were not deleted.

| Claim | Source |
| --- | --- |
| Literacy ~2,500–3,000 characters; top ~100 cover ~40%+ of written text | HSKLord, HanziCraft, summarised in that document |
| Frequency table: 100 / ~41–42%; 500 / ~75%; 1,000 / ~89%; 2,500 / ~97–98%; 3,000 / ~99% | same |
| ~200+ traditional radicals; common ~30–50 (up to ~100 meaning components) | Mandarin HQ, Hacking Chinese, HSKLord |
| Springer 2026 radical/dual-coding article | https://link.springer.com/article/10.1007/s11145-026-10851-z |
| Visual/verbal coding mnemonics (Springer) | https://link.springer.com/article/10.1007/BF02504673 |

### Application views

| Claim | Where | Kind | Provenance |
| --- | --- | --- | --- |
| `{dataset.meta.recordCount} records` | `/arbeitsmarkt` (`apps/arbeitsmarkt/app/arbeitsmarkt/page.tsx`) | measurement of the committed dataset | `RECORD_COUNT` 24 in `lib/dataset/parts.ts`; tests assert 24 |
| digest size from the profile | `/arbeitsmarkt/digest` | parameter | `data/profile.json` `digestSize` |
| INTERACTIONS.md measured traces (80 nectar, 24 bees, 20 simulated seconds, …) | `apps/bienenstock/docs/INTERACTIONS.md` | measurement | commands quoted in that file (`vitest run tests/interactions.test.ts`, named seeds) |

### Seed length

`apps/simplified/lib/radicals/seed.ts`: 45 `id:` entries on 2026-09-12. Command: count `^\s+id: "` in that file.
<!-- END PRESERVE:inventory -->

## Re-running

A later reader re-runs `node tools/audit-published-claims.mjs --check`. That command re-discovers card claims and markdown prose counts from the tracked tree and fails if any of them is missing from this document. It does not spawn `npm`, does not read `node_modules`, and does not compare the date column.

<!-- BEGIN CLAIM_AUDIT_ROWS
row	card:ameisenwerkstatt	measurement	62 tests over its simulation, HTTP façade and tool allowlist, all passing
row	card:arbeitsmarkt	measurement	23 tests over the synthetic dataset generator, the ranking pipeline and the operations model, all passing
row	card:bienenstock	measurement	13 tests over the colony model, its interactions and the canvas sizing, all passing
row	card:simplified	measurement	29 tests over the radicals data, practice sessions and health shape, all passing
row	prose:docs/DEPLOY.md:20 route(s)	measurement	20 route(s)
row	prose:docs/DEPLOY.md:5 URL(s)	measurement	5 URL(s)
row	prose:tools/prompts/goc-39-40-published-audits.md:13 tests	measurement	13 tests
row	prose:tools/prompts/goc-39-40-published-audits.md:20 route(s)	measurement	20 route(s)
row	prose:tools/prompts/goc-39-40-published-audits.md:23 tests	measurement	23 tests
row	prose:tools/prompts/goc-39-40-published-audits.md:29 tests	measurement	29 tests
row	prose:tools/prompts/goc-39-40-published-audits.md:5 URL(s)	measurement	5 URL(s)
row	prose:tools/prompts/goc-39-40-published-audits.md:62 tests	measurement	62 tests
row	suite:apps/ameisenwerkstatt	measurement	62 tests
row	suite:apps/arbeitsmarkt	measurement	23 tests
row	suite:apps/bienenstock	measurement	13 tests
row	suite:apps/simplified	measurement	29 tests
row	suite:landing	measurement	67 tests
END CLAIM_AUDIT_ROWS -->
