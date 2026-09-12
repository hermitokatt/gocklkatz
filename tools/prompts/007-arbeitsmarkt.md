# Worker brief — GOC-28 (add apps/arbeitsmarkt, synthetic dataset and generator)

You are the **implementer**. A separate orchestrator owns the requirement, reviews your tree, and
authors the commit. Read these first:

1. `docs/tickets/005-arbeitsmarkt.md` — the constraint that shapes this whole demo. Read it before
   writing anything; this is not a normal build.
2. `AGENTS.md` — the standing contract, especially §1 (identity), §2 (public bar), §4
   (non-negotiables), §6 (guards must be seen to fail) and §7 (verify by running).
3. `LESSONS_LEARNED.md` — the standing lessons, and the Bienenstock entries. Lessons 1, 2 and 5 have
   each cost this repository a full cycle.
4. `apps/bienenstock/` — the app built immediately before this one. **Match its shape** for
   `scripts/ci.sh`, `scripts/verify.sh`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
   `vitest.config.mts`, `.prettierrc.json`, `.prettierignore` and the `repo.config` entry.
   **Do not copy its code.**

This is a **greenfield build**. There is no existing Arbeitsmarkt application.

## The constraint, before anything else

**The pipeline this demo is about collects third-party job listings, and none of that data may be
committed or published.** So this app presents the *system* using **synthetic** data. That is the
whole point of the demo, not a limitation to work around.

Consequences you must honour:

* **No network access at build, test or runtime.** The app must build and test with no network. The
  dataset is generated from a checked-in seed and committed.
* **No scraping framework and no browser driver, anywhere** — not in `dependencies`, not in
  `devDependencies`. `playwright` is on the allowlist but is not to be installed or used here.
* **A silent fallback is a defect.** The tempting design is "try to fetch real listings, fall back to
  synthetic when offline". Do not build that. A `fetch` guarded by a `try`/`catch` that swallows the
  failure passes CI, passes offline, and still ships a data acquisition path into a public demo. The
  app acquires nothing.

## Hard rules

* **Do not commit. Do not push. Do not create a branch.** Leave your work in the working tree.
* **Do not edit any ticket, and do not edit `repo.config`'s existing entries** — add one block and
  change nothing else there.
* **Do not edit the root landing page, `src/lib/demos.ts`, `README.md`, or any other app.** Report
  what you find wrong in them instead; two things in them are already known to be wrong and are
  listed under "Report what you observe" below.
* **Do not write machine-local absolute paths**, or patterns from `tools/pii-patterns.txt`, into any
  tracked file.
* **Never copy a directory recursively, and never leave `node_modules`, `.next`, an npm cache or any
  build output where git could track it.** Two earlier runs dragged in 24,047 and 22,319 files this
  way. Check `git status` before you finish.
* **This repository is public.** No secrets, no credentials, no personal names.

## What to build

### 1. A self-contained app at `apps/arbeitsmarkt`

Own `package.json`, `package-lock.json`, `scripts/ci.sh`, TypeScript strict, Vitest, ESLint,
Prettier. No npm workspaces; do not import from another app.

Dependencies: only what is already on `docs/DEPENDENCY_ALLOWLIST.md` — match `apps/bienenstock`'s
list. **You are not adding a package.** If you believe one is missing, stop and say so rather than
editing the allowlist.

Use **verify port 43127**. 43123, 43124, 43125 and 43126 are taken.

Run `npm install` to produce the lockfile. The lockfile is committed; `node_modules` is not.

### 2. A generator, committed, that produces the dataset from a seed

A module under `lib/` that turns a numeric seed into a dataset. Requirements:

* **Deterministic.** Same seed, same dataset, byte for byte. `Math.random` must not appear anywhere in
  it — use a seeded generator, as `apps/bienenstock` does.
* **No clock.** Do not derive anything from `Date.now()` or the current date, or the output stops
  being reproducible and the determinism test starts failing on its own next month. If records need
  dates, generate them from the seed within a fixed window and record the window as data.
* **Committed output.** Commit the generated dataset file as well, and add a test asserting the
  committed file equals a fresh generation. That is what makes "no mystery blob" checkable: the file
  is data a reader can inspect, and the test proves it came from the generator.

### 3. Synthetic in every field, and impossible to mistake for real

* Company names, locations, titles and posting dates are **all** generated.
* **Names must be plainly constructed, not plausible trademarks.** Do not generate anything that
  reads like a real employer. Prefer an obviously synthetic construction — invented word-parts
  combined mechanically — and say in `docs/` what the construction rule is, so a reader can tell at a
  glance that no real company is named. If you generate from a word list, the list is committed too.
* Include a small **legend or index** in the dataset that maps generated name-parts to their
  meaning, so the artificiality is self-evident rather than asserted.
* Do not use a real place as a generated location if that could read as a real vacancy.

### 4. The dataset flags itself as synthetic — in the data

Acceptance criterion A-3 is explicit: every record is flagged in the dataset, **not only in the UI.**
Design the shape so this is structural rather than decorative:

* a dataset-level marker carrying the schema version, the seed, and an explicit synthetic statement;
* a per-record field that marks the record synthetic, so a consumer cannot select records without
  carrying the flag.

A field that is always `true` and nothing reads is exactly the "config flag that parses but changes
nothing" failure in `AGENTS.md` §6. Make the test assert the flag is present **and** that a
synthetic-only filter returns every record.

### 5. A visible statement that the data is synthetic

Route `/arbeitsmarkt` renders a page that states clearly, in the page itself, that the data is
synthetic and generated for demonstration. This is the first of several views — a later issue adds
the ranked digest and another adds the operational view — so leave a structure those can extend.

Portfolio-grade presentation: this is a demo someone will look at, not a JSON dump with a heading.

### 6. `scripts/ci.sh` that stands itself up

Runs `npm ci` when `node_modules` is absent, then **format, lint, typecheck, tests, build** — the
order and the shape `apps/bienenstock/scripts/ci.sh` uses. Formatting is checked, not merely
configured; every app in this monorepo now checks it and a new app that does not would be the odd one
out.

### 7. `scripts/verify.sh` that proves the app RUNS

Copy the shape of `apps/bienenstock/scripts/verify.sh`: build, start, wait for the port rather than
assuming it, probe, always shut down, assert the port was released, fail cleanly if it is bound.

Assert on **content, not status alone**:

* `GET /arbeitsmarkt` is 200 **and** the served HTML contains the synthetic-data statement **and**
  contains a string the page actually renders;
* `GET /api/health` is 200, JSON, `"ok": true`, **and** names this app — every app here answers
  `ok: true`, so without the service name a sibling app on the wrong port would pass.

Add a test proving the app needs no network: the dataset module must not import a network module. A
source scan is acceptable and cheap — assert that no file under `lib/` or `app/` contains a `fetch`
call to an external host.

### 8. Register the app and record the port

* `repo.config`: `enabled: true`, `verify_cmd: bash scripts/verify.sh`. Match the existing blocks
  exactly — a past edit produced a duplicated block the gate then reported twice.
* `docs/DEPLOY.md`: add the port to the verify-port table.

### 9. `apps/arbeitsmarkt/docs/`

Root `AGENTS.md` §4 already points readers at `apps/arbeitsmarkt/docs/` for "the evidence" that
browser drivers and scraping frameworks were measured and rejected. That directory does not exist.
Create it, and write down:

* the synthetic-data model: the seed, the generation rules, and the naming construction;
* why the acquisition path is absent from the shipped app, and what a deployment would do instead.

Keep it honest. Do not claim a measurement that was not made — if the evidence for rejecting a
browser driver is that it is not needed here, say that rather than inventing a benchmark.

## Acceptance criteria — run these and paste the raw output

* **A-1** `cd apps/arbeitsmarkt && bash scripts/ci.sh` exits 0, including a determinism test.
* **A-2** Running the generator twice with the same seed produces **byte-identical** output —
  asserted in a test, with the output pasted. Show the comparison, not just a passing assertion.
* **A-3** Every synthetic record is flagged as such in the dataset itself. Paste the shape and the
  test output.
* **A-4** `bash tools/gate.sh` exits 0 and reports the app running and serving.

## Proving a check can fail

`AGENTS.md` §6, and this is where workers have lost time. For **each new assertion**, break the
behaviour deliberately, paste the failing output, then revert.

**Break the content or the behaviour, not the types.** A TypeScript error or a Zod failure stops the
build, which fails the check for the wrong reason and proves nothing about your assertion. A previous
worker tried to break a determinism test with a `Math.random()` call; the *source scan* caught it
while the determinism test stayed green. That run proved something real, but not the thing intended.

A good break for each of these:

* determinism: make the generator consult the clock or the environment once;
* committed-output equality: hand-edit the committed dataset by one byte;
* synthetic filter: drop the per-record flag from one record;
* verify content: remove the synthetic statement from the page while it still answers 200.

## Report what you observe

Two things in this repository are already known to be wrong about this app. Confirm or correct them,
and add anything else you find:

1. **`src/lib/demos.ts`** describes Arbeitsmarkt as "Relevance-ranked IT job listings from public
   APIs". The epic this app belongs to says the data is synthetic and that none of it may be
   published. Do not edit the file — report whether the copy contradicts the constraint.
2. **`README.md`** repeats that claim for `apps/arbeitsmarkt`.
3. **`AGENTS.md` §4** points at `apps/arbeitsmarkt/docs/` for evidence that does not exist yet.

## How to report

1. **What you did** — files created, and any decision the ticket did not cover.
2. **Acceptance evidence** — each command with raw output, plus a deliberate failure for each new
   assertion.
3. **What you did NOT verify.**
4. **The observations** from the section above.

Do not claim success without pasted command output. If something does not work, say what you observed
rather than describing what you intended.
