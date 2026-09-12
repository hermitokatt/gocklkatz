# Worker brief — GOC-38 legal and terms-of-service position

You are the **implementer**. A separate orchestrator owns the requirement, reviews your tree, and
authors the commit. Read these first, in order:

1. `AGENTS.md` — the standing contract. §1 (identity), §2 (public bar), §4 (non-negotiables),
   §6 (a guard must be seen to fail), §7 (verify by running).
2. `docs/DEPENDENCY_ALLOWLIST.md` and `tools/check-deps.mjs` — the existing allowlist control and
   the house style for a repository tool: Node built-ins only, no third-party dependencies, a
   documented usage block, and a matching test under `tests/`.
3. `tools/gate.sh` — where a repository-wide guard is wired in, and `tests/gate.test.sh` — how that
   wiring is tested.

## The frozen requirement

Linear issue **GOC-38**, "Publish the legal and terms-of-service position", verbatim:

> **Requirement**
>
> 1. **Code licence** is present and correct at the root, and every application declares the same
>    licence in its manifest.
> 2. **Dependency licences**: every direct dependency's licence is compatible with redistributing
>    this repository publicly. Record the check and any that needed attention.
> 3. **Vendored content**: any data, font, image or text that came from elsewhere has a stated
>    origin and a licence permitting redistribution — or is removed.
> 4. **Terms of service**: where a project interacts with a third-party service, the repository
>    states what the service's terms allow and what this project does inside that boundary. The
>    job-listings pipeline is the one that matters; its compliance rules must be described here,
>    not only in its own documents.
> 5. The statement lives in the repository and is linked from the root `README.md`, so it is part of
>    the published artifact rather than a private note.
>
> **Acceptance criteria**
>
> **A-1** A licence file is present and the root `README.md` links to the position document.
> **A-2** Every direct dependency's licence is listed with its compatibility conclusion.
> **A-3** Every vendored item has an origin and a redistribution-permitting licence, or is gone.
> **A-4** The document states, for the job-listings pipeline, which sources are permitted and which
> are disabled, and why.
>
> **Stop and ask** — If any dependency's licence, or any dataset's terms, is unclear or
> incompatible, do not publish. Report it and propose a replacement.

## Deliverables

### 1. `docs/LEGAL.md` — the position document

The published statement. It must contain, in this order:

- **Code licence.** MIT, `Gocklkatz Inc`, and what that means for a reader who wants to reuse the
  code. The root `LICENSE` already exists and is correct — cite it, do not restate it at length.
- **Dependency licences.** The generated table from `tools/audit-licences.mjs` (deliverable 2), one
  row per direct dependency: package, version, licence, conclusion. State the conclusion rule you
  applied and name any dependency that needed attention.
- **Vendored and third-party content.** One subsection per item, each with **origin**, **licence**,
  and **why redistribution is permitted**. The items are listed under "Vendored content, exactly"
  below — that list is the inventory, not a suggestion.
- **Terms of service.** For each project that touches a third-party service, what the service's
  terms allow and what this project does inside that boundary. The job-listings pipeline is
  required to be covered here, not only in its own documents. Cover the Google Fonts build-time
  fetch as well as the listings sources.
- **What this repository does not do**, stated affirmatively: it acquires nothing, publishes no
  scraped content, and ships no browser driver or scraping framework at runtime (`AGENTS.md` §4).

### 2. `tools/audit-licences.mjs` — the re-runnable check

Node built-ins only. No new dependencies.

```
node tools/audit-licences.mjs                    check every manifest in the repository
node tools/audit-licences.mjs --list             print the dependency licence table
node tools/audit-licences.mjs --file P --modules D   check one manifest against a modules dir
```

- Discovery: every tracked `package.json`, the same way `tools/check-deps.mjs` does it.
- For each **direct** dependency, resolve `node_modules/<name>/package.json` and read its licence
  from `license`, falling back to `licenses[].type`, then to `UNKNOWN`. Missing module directory is
  `UNKNOWN`, not a pass.
- **Exit 1 and name every problem** when a licence is outside the allowlist or is `UNKNOWN`. Exit 0
  only when all direct dependencies are in the allowlist.
- `--file P --modules D` exists so a fixture can exercise both directions without touching the real
  tree. Model the flag names on `tools/check-deps.mjs`.
- **This allowlist is a decision, not a default.** Use exactly these identifiers, normalising case
  and treating `BSD-2-Clause`/`BSD-3-Clause` spellings as written:

  `MIT`, `MIT-0`, `ISC`, `0BSD`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `Unlicense`,
  `CC0-1.0`, `BlueOak-1.0.0`, `Python-2.0`, `Zlib`, `OFL-1.1`, `CC-BY-4.0`, `MPL-2.0`, `WTFPL`

  Anything else fails. **Do not widen this list to make a check pass.** If a real dependency's
  licence is not on it, that is the finding the ticket asks for: stop, report it, and propose a
  replacement (GOC-38 "Stop and ask").

### 3. `apps/*/package.json` — the licence field

All four application manifests currently declare **no** `license`. Add `"license": "MIT"` to each,
matching the root manifest. Do not change anything else in those files. Preserve the existing key
order and formatting so the diff is one added line per file, and run
`npx prettier --check` on each file you touch.

### 4. `tests/licence-audit.test.mjs` and the gate wiring

- A vitest suite under `tests/`, in the style of `tests/dependency-allowlist.test.mjs`, that
  exercises `--file`/`--modules` against fixtures you construct in a temporary directory.
- **It must include cases that fail**, and you must paste their failure: a `GPL-3.0-only`
  dependency, an `AGPL-3.0` dependency, and a dependency whose manifest has **no** `license` field.
  A suite with only passing cases proves nothing (`AGENTS.md` §6).
- Wire `node tools/audit-licences.mjs` into `tools/gate.sh` next to the existing
  `tools/check-deps.mjs` step, in the same reporting style, and add the new test to the gate's
  self-test list. Prove `bash tests/gate.test.sh` still passes.
- Add the new test to the root `scripts/ci.sh` test run **only if** the existing suites there are
  run by a glob; otherwise say so and leave `scripts/ci.sh` alone.

### 5. `README.md` — the link

Add the link to `docs/LEGAL.md` from the root `README.md`, in the section that already points at
`docs/DEPLOY.md`. Change nothing else in `README.md` — another change to this file is in flight.

## Vendored content, exactly

This inventory was established by the orchestrator. Verify each one against the tree rather than
trusting this list, and report anything you find that is *not* listed.

1. **Google fonts, `apps/simplified/app/layout.tsx`** imports `Literata`, `Noto_Sans_SC` and `Syne`
   from `next/font/google`. These are downloaded at **build time** and self-hosted by Next.js — the
   deployed artifact redistributes the font software, and makes no runtime request to Google.
   Origin and licence are confirmed: all three live under `ofl/` in the canonical
   `github.com/google/fonts` repository and each ships an `OFL.txt`, so each is **SIL Open Font
   License 1.1**:
   - <https://github.com/google/fonts/tree/main/ofl/literata>
   - <https://github.com/google/fonts/tree/main/ofl/syne>
   - <https://github.com/google/fonts/tree/main/ofl/notosanssc>

   Cite those three URLs. State the OFL obligation you find (it is about the licence and copyright
   notice accompanying copies of the font software) and **create `THIRD_PARTY_NOTICES.md`** at the
   repository root carrying, for each of the three fonts, its name, its origin, `OFL-1.1`, its
   upstream copyright line, and the licence text — so the obligation is met by the repository
   rather than only described. Read the copyright line from the upstream `METADATA.pb` or
   `OFL.txt`; do not invent it. If you cannot fetch an upstream file, write `not verified` and
   report it rather than filling the gap.

2. **`apps/ameisenwerkstatt/docs/ameisen-ui-samples/*.png` and `*.html`** — five design samples.
   Establish from the tree and its documents whether these were authored here or came from
   elsewhere, and state the origin you can actually support. If the evidence does not settle it,
   say so and report it.

3. **`apps/arbeitsmarkt/data/*.json`** — synthetic, generated in this repository from a checked-in
   seed. Cite `apps/arbeitsmarkt/docs/SYNTHETIC_DATA.md` and the generator, and state plainly that
   the records are not third-party data and are not scraped.

4. **`apps/simplified/lib/radicals/seed.ts`** — a curated seed of characters with pinyin and
   glosses. Cite `apps/simplified/docs/hanzi_research.md` as the research input and state that the
   seed is hand-authored here. Confirm no scraped text is committed, and state that
   `hanzi_research.md` is a summary with citations rather than copied text. If any passage in it
   reads as copied rather than summarised, **stop and report it** — do not silently rewrite it.

5. **Fonts that are not vendored.** `apps/simplified/docs/FONTS.md` is a plan, and the other three
   apps use system font stacks only. Confirm no `woff`/`woff2`/`ttf`/`otf` file is tracked
   (`git ls-files`) and say so.

## Terms of service, exactly

Read `apps/arbeitsmarkt/docs/` in full — especially anything about sources, compliance, permitted
sources and disabled sources — and `apps/arbeitsmarkt/data/sources.json`. `docs/LEGAL.md` must
state, for the job-listings pipeline, **which sources are permitted and which are disabled, and
why**, in this document rather than only by reference. Cite the app's own documents.

Also state, for the Google Fonts build-time fetch, what the terms allow and confirm that the
deployed site serves the fonts from its own origin.

## Hard rules

- **Do not commit. Do not push. Do not create a branch.** Leave your work in the working tree.
- **Do not add a dependency.** Adding one requires the allowlist and a ticket, and is out of scope.
- **No absolute local paths, no personal names or emails, no secrets** in anything you write.
  `tools/guard.sh` enforces this and will be run against your tree.
- **Do not edit:** `docs/DEPLOY.md`, `AGENTS.md`, `docs/tickets/`, `scripts/probe.mjs`,
  `tools/mirror-to-github.sh`. Other changes are in flight.
- **Do not run `bash tools/gate.sh`** — it takes a minute and the tree is shared. Run the narrow
  commands below instead.
- If a fact cannot be established, write `not verified` and report it. **An invented licence or
  copyright line is worse than a gap**, and this is a legal document.

## Evidence to paste in your report

```
node tools/audit-licences.mjs --list          # the table that goes into docs/LEGAL.md
npx vitest run tests/licence-audit.test.mjs   # including the failing fixtures
bash tests/gate.test.sh                       # still green after the wiring change
npx prettier --check <files you touched>
node tools/check-deps.mjs                     # unchanged behaviour
tools/guard.sh                                # clean
```

## Report

What you built, the exact commands above with their observed output, **what you did not verify**,
and any decision the requirement did not cover. Do not report success without pasted output.
