# Worker brief — GOC-39 and GOC-40, the published-claim and published-link audits

You are the **implementer**. A separate orchestrator owns the requirement, reviews your tree, and
authors the commit. Read these first, in order:

1. `AGENTS.md` — the standing contract. §2 (public bar), §4 ("never publish a number without its
   provenance", "never publish a link that has not been fetched"), §6 (a guard must be seen to
   fail), §7 (verify by running).
2. `src/lib/demos.ts` — the four landing-page card claims, each with `source` and `command`.
3. `scripts/probe.mjs` and `scripts/verify.sh` — the landing page's existing served-output checks,
   and the house style for a check that fails loudly.
4. `tools/verify-live.sh` — how this repository fetches a URL anonymously and reports what it got.

Two Linear issues, two deliverables. Both audits produce (a) a **re-runnable script** that discovers
its own input from the tracked tree, and (b) a **committed document** that records the result.

---

# GOC-40 — audit every published link

## The frozen requirement, verbatim

> **Requirement**
>
> 1. Every external link published anywhere in the repository — documents included — is fetched and
>    its status recorded.
> 2. Any link that does not resolve is removed or corrected.
> 3. Confirm every card marked `live` still resolves, and every card marked `in-development` renders
>    no link.
> 4. Commit the audit, so a later reader can re-run it.
>
> **Acceptance criteria**
>
> **A-1** Every external link in every tracked document returns a success status, or has been
> removed.
> **A-2** The audit document lists each URL, its status, and the date it was checked.
> **A-3** `bash scripts/verify.sh` exits 0, so the card rule holds as well.

## Deliverables

**`tools/audit-published-links.mjs`** — Node built-ins only, no new dependencies.

```
node tools/audit-published-links.mjs            fetch and report every link; exit 1 on a failure
node tools/audit-published-links.mjs --write    regenerate docs/LINK_AUDIT.md
node tools/audit-published-links.mjs --check    fail if docs/LINK_AUDIT.md is stale or incomplete
```

- **Discovery is from the tracked tree**, via `git ls-files`, not from a hand-written list. A
  hand-written list is the failure mode this ticket exists to prevent.
- **Every discovered URL must land in exactly one class**, and the document must show all of them.
  A URL that is silently skipped is how a check becomes a no-op (`AGENTS.md` §7). The classes are:

  | Class | Fetched? | Meaning |
  | --- | --- | --- |
  | `external` | **yes** | A real third-party or published address. Must return a success status. |
  | `local` | no | `localhost`, `127.0.0.1`, a port on this machine, or a shell variable such as `$HOST:$PORT`. Reachable only from a developer's machine. |
  | `fixture` | no | Deliberately unresolvable, e.g. a host under `.invalid`. Must **not** resolve; these exist so a negative test can fail on purpose. |
  | `placeholder` | no | A URL inside a documented example of failure output, or otherwise not a published link. |

  Classification must be by rule, and every `local`, `fixture` and `placeholder` entry carries the
  reason in the document. Do not use a hand-maintained exclusion list of URLs.

- `--check` asserts the committed document is **current and complete**: every URL discovered now
  appears in it, and every `external` URL in it is recorded as ok. It must fail when a new link is
  added to any tracked file without regenerating the document. State the date column as
  informational — `--check` does not compare it.
- Exclude `package-lock.json`. Those `resolved` fields are npm registry resolution records, not
  published links.

**`docs/LINK_AUDIT.md`** — written by `--write`, hand-edited only for prose. It must contain the
date checked, the command that produced it, the count per class, the full table, the A-3 evidence
(the observed `bash scripts/verify.sh` result), and a short note that a later reader re-runs
`--check`.

## Notes specific to this audit

- Expect roughly 90 distinct URLs across the tracked tree, of which roughly half are `local` or
  `fixture`. `docs/DEPLOY.md` deliberately quotes failure output containing `no-such-host.invalid`.
- `apps/simplified/docs/hanzi_research.md` is the densest source of real external links. All of them
  are `external` and all must be fetched.
- Fetching must be anonymous and must **not** follow redirects into a login page and call it
  success — see how `tools/verify-live.sh` handles this, and report what you did the same way.
- A link that fails: **correct or remove it**, per requirement 2, and say in the document which you
  did and why. Do not delete a citation to make the audit green — that is the one outcome worse
  than a failing link.

---

# GOC-39 — audit every published claim for provenance

## The frozen requirement, verbatim

> **Requirement**
>
> 1. Every number published anywhere in the repository — the landing page, any application view, any
>    document — is traced to the command that produced it and the date it was produced.
> 2. Any number that cannot be traced is removed, or replaced by one that can.
> 3. The audit lists every claim, its source, and its date, and is committed so the next reader can
>    re-run the check.
>
> **Acceptance criteria**
>
> **A-1** A committed document lists every published claim with its reproducing command and date.
> **A-2** Re-running the listed commands reproduces the published numbers, or the claim is flagged
> and removed.
> **A-3** No published number is left without an entry.
>
> **Notes** — If a claim cannot be reproduced, that is a finding, not a documentation problem.
> Remove the claim and say so.

## The provenance rule to apply — this is a decision, use it exactly

Not every published number is a measurement, and forcing one rule onto all of them produces a
document nobody can check. Classify every number into exactly one of three kinds:

| Kind | What it is | What it must record |
| --- | --- | --- |
| `measurement` | A number **about this repository** — a test count, a route count, a duration, a payload size. | The command that reproduces it, the value observed when you ran it, and the date. |
| `citation` | A number **about the outside world**, taken from a published source. | The source URL and the date retrieved. |
| `parameter` | A number that is an **input, not a result** — a port, a version range, a seeded constant, a currency limit, a licence's terms. | The file that declares it. It is not "reproduced"; it is declared. |

**Anything that is none of the three is a finding.** Remove it and say so, per requirement 2.

## Deliverables

**`tools/audit-published-claims.mjs`** — Node built-ins only.

```
node tools/audit-published-claims.mjs           list every claim with its kind and provenance
node tools/audit-published-claims.mjs --write   regenerate docs/CLAIM_AUDIT.md
node tools/audit-published-claims.mjs --check   fail when a claim is recorded nowhere
```

- It must **discover** the claims it can discover mechanically rather than trusting a list:

  * the four landing-page card claims and their counts, read from the built or served landing page
    the way `scripts/probe.mjs` reads them — or from `src/lib/demos.ts` plus a real run;
  * prose counts in documents written as `NN tests`, `NN route(s)`, `NN URL(s)`, `NN application(s)`,
    `NN project(s)` — a regular expression over the tracked markdown;
  * the per-application test counts, by running each application's test command and counting the
    tests it reports.

- `--check` fails when a discovered claim appears in no entry of the committed document. Like the
  link audit, this is what stops the document going stale without anyone noticing.

**`docs/CLAIM_AUDIT.md`** — the audit. One row per claim: the claim as published, **where** it is
published (file or route), its kind, its provenance (command or URL or declaring file), the value
observed on the date of the audit, and a verdict. Then the honest part:

- every claim that could **not** be reproduced, flagged and removed, per the Notes;
- every place a published number was found with **no** provenance, removed and named;
- the A-2 evidence for the four card claims: the actual `npm run test` output per application,
  showing the count.

## Seed inventory — verify, do not trust

This is what the orchestrator found. **Run your own discovery and report anything not on this
list**; an audit that only confirms the list it was given has audited nothing.

1. **Landing page card claims** (`src/lib/demos.ts`): `62 tests over its simulation, HTTP façade and
   tool allowlist, all passing` (Ameisenwerkstatt), `13 tests over the colony model, its
   interactions and the canvas sizing, all passing` (Bienenstock), `29 tests over the radical
   domain, its schema and its examples, all passing` (Simplified), `23 tests over the synthetic
   dataset, its generator and its profiles, all passing` (Arbeitsmarkt). Each has
   `command: "npm run test"`. These are `measurement`. **Re-run each app's `npm run test` and
   confirm the count.** `src/lib/demos.test.ts` already asserts the claim's number against the
   number of `it(` in the cited test file — say so, and say whether your run agrees.
2. **`docs/DEPLOY.md`** carries several: gate self-test counts (13 / 8 / 14 cases), `20 route(s)`,
   `5 URL(s)`, payload sizes in bytes, the Vercel limits `100` and `2`/`five`, port numbers, and
   `Node.js Version 24.x`. Decide each one's kind and record its provenance. **The byte counts and
   the timestamp in its quoted output are `measurement` values that drift** — they are already
   labelled as illustrative in that document; record them as such rather than re-measuring them
   into a moving target.
3. **`docs/DEPENDENCY_ALLOWLIST.md`** declares version ranges for every package. `parameter`.
4. **`apps/simplified/docs/hanzi_research.md`** cites external figures — literacy targets,
   frequency coverage percentages. `citation`. Record the source URL and retrieval date.
5. **`apps/simplified/lib/radicals/README.md`** says "~30–50 beginner components". Check it against
   the actual length of the seed and report the disagreement if there is one.
6. **Application documentation and views** — `apps/ameisenwerkstatt/docs/`,
   `apps/bienenstock/docs/`, `apps/arbeitsmarkt/docs/` and the rendered pages. Find their numbers.
7. **Ports** in `repo.config`, every `scripts/verify.sh`, and `docs/DEPLOY.md`. `parameter`.

---

# Both audits — hard rules

- **Do not commit. Do not push. Do not create a branch.** Leave your work in the working tree.
- **Node built-ins only.** No new dependencies; adding one needs the allowlist and a ticket.
- **No absolute local paths, no personal names or emails, no secrets.** `tools/guard.sh` will be
  run against your tree.
- **Do not edit:** `AGENTS.md`, `README.md`, `app/globals.css`, `scripts/probe.mjs`,
  `scripts/probe.test.mjs`, `tools/check-deps.mjs`, `tools/gate.sh`, `docs/LEGAL.md`,
  `THIRD_PARTY_NOTICES.md`, any `package.json`, `apps/simplified/AGENT.md`,
  `apps/simplified/docs/MVP.md`, `apps/simplified/docs/ROADMAP.md`. Other changes are in flight.
- **Do not run `bash tools/gate.sh`.** It takes a minute and the tree is shared.
- Do not invent a status, a count, or a date. If a fetch fails, record the failure and its reason.
  **A fabricated row in an audit is the one thing that makes this deliverable worthless.**

## Evidence to paste in your report

```
node tools/audit-published-links.mjs --write
node tools/audit-published-links.mjs --check
node tools/audit-published-claims.mjs --write
node tools/audit-published-claims.mjs --check
bash scripts/verify.sh                       # A-3 of GOC-40
npm run test                                 # root: the probe and demo suites
```

Then **prove `--check` is not a no-op in both audits**: add a link and a claim to a scratch tracked
document, show `--check` failing, and paste that failure. `AGENTS.md` §6.

## Report

What you built, each command above with its observed output, the claims and links that were
**removed or corrected** and why, **what you did not verify**, and any decision the requirement did
not cover. Do not report success without pasted output.

---

# Addendum — added by the orchestrator after the GOC-38 worker run

One defect from that run is worth carrying into these two audits, because both of them discover
their own input from the tree and both will be re-run somewhere that is not this machine.

**A check must work on a tree where nothing has been installed.** The GOC-38 audit read
`node_modules`, which exists here and does not exist on a fresh CI checkout. It passed locally and
would have failed on every CI run — every package resolving to UNKNOWN. It was measured in a clean
`git worktree` before it was fixed, and the fix was to read the committed
`package-lock.json` instead. Neither script in this ticket may depend on `node_modules`, on a build
output, or on anything else that is absent from a fresh clone. If your audit needs generated data,
generate it or read the committed artefact.

**Prove a must-fail case on the path the check actually takes.** That worker's fixtures all
exercised a fallback branch, so the branch that CI would use had no failing test at all. When you
demonstrate that `--check` fails, do it on the primary path with a fresh clone's conditions.

**A note on the local harness, so you are not misled.** `tools/guard.sh` lists files from the git
index. If a tracked file is deleted on disk but the deletion is not staged, the guard's scanners
cannot read it and the guard fails with "the scanner could not run" — a real refusal, but a
misleading message. Stage deletions with `git rm` or `git add -A` before reading a guard result.
You are not asked to fix that; it is recorded as its own finding.

**Do not run `bash tools/gate.sh`.** It takes a minute, and the orchestrator runs it on the final
tree. The narrow commands in your Evidence section are enough.
