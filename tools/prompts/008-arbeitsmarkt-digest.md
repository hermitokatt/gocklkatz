# Worker brief — GOC-29 (render the relevance-ranked digest)

You are the **implementer**. A separate orchestrator owns the requirement, reviews your tree, and
authors the commit. Read these first:

1. `AGENTS.md` — the standing contract, especially §1 (identity), §2 (public bar), §6 (guards must be
   seen to fail) and §7 (verify by running).
2. `LESSONS_LEARNED.md` — the standing lessons, and the Arbeitsmarkt entry from the previous issue,
   which records a guard that was named for something it did not check.
3. `apps/arbeitsmarkt/` — the app you are extending, and `apps/arbeitsmarkt/AGENTS.md` for its rules.
4. `apps/arbeitsmarkt/docs/SYNTHETIC_DATA.md` and `docs/ACQUISITION.md` — what data exists and why
   there is no acquisition path.

The dataset exists and one view renders it. This issue adds the pipeline's **output**.

## Hard rules

* **Do not commit. Do not push. Do not create a branch.** Leave your work in the working tree.
* **Do not edit anything outside `apps/arbeitsmarkt/` except `LESSONS_LEARNED.md`** — read the note
  about that file at the end before touching it.
* **Do not edit `src/lib/demos.ts`, the root `README.md`, or another app.** Report what you find
  wrong in them instead.
* **Do not write machine-local absolute paths**, or patterns from `tools/pii-patterns.txt`, into any
  tracked file.
* **Never copy a directory recursively, and never leave `node_modules`, `.next`, an npm cache or any
  build output where git could track it.**
* **This repository is public.** No secrets, no credentials, no personal names.
* **Do not add a dependency.** If you believe one is missing, stop and say so.
* **No acquisition path, still.** Do not add `fetch`, a scraping framework, or a browser driver. The
  digest is computed from the committed dataset, in-process.

## What to build

### 1. The ranking stage does not exist yet — build it

The dataset has `title`, `companyName`, `location` and `postedOn` and **no score**. Requirement 3
asks that the stages be visible as *collect → filter → rank → digest*, "so a reader can see that
ranking is a late stage over a filtered set, not a search". So this issue adds the filter and the
rank, not only a view.

Put it in a **pure module** — `lib/pipeline/` is the obvious home — importing nothing from `three`,
touching no DOM, and reading no clock or environment. It is the same discipline the generator
follows, and for the same reason: a ranking that changes when nothing changed cannot be asserted.

### 2. A candidate profile, committed and synthetic

Ranking needs something to rank *against*. Define a small candidate profile as **committed data**,
not a hard-coded literal buried in a function — a reader should be able to see what the pipeline is
matching on. It must be obviously synthetic like everything else here: no real person, no real
employer, no real place. Do not invent a named individual.

The profile is the sorted input to the rank, so it belongs in the data.

### 3. Filter, then rank — and keep them distinguishable

* **Filter**: a stage that removes listings that are *ineligible* for a reason a reader can see. Each
  rejected listing must carry the reason it was rejected. A filter that silently drops rows is the
  interesting part of this system done wrong.
* **Rank**: score the survivors against the profile. The score must decompose into **named
  components** with weights, so a position can be explained rather than asserted.

Whatever rules you choose, they must be:
* deterministic, given the dataset and the profile;
* stated in `docs/` — what the profile is, what each filter rejects, what each scoring component
  measures, and the weights;
* honest about being a demonstration model, not a validated ranking. Say that plainly, the way
  `docs/FORAGING.md` does in the Bienenstock app.

### 4. The digest view

A server-rendered route. `/arbeitsmarkt/digest` is the natural name; say if you choose otherwise.

It must show:

* the pipeline stages **in order**, with counts at each one, so the funnel is visible;
* the ranked digest itself: rank, title, employer, location, and the score that placed it there;
* for **each** entry, the **reason** — which scoring components contributed and how much. Not a bare
  number. Requirement 2 is the point of the whole ticket;
* the synthetic-data statement, present on this view;
* listings the filter rejected, with the reason, so "filter" is visible rather than implied.

**Server-rendered. No client-side fetching for content.** The HTML the server returns must contain
the digest. If the page needs interactivity, it is additive and must not be how the content arrives.

### 5. Extend `scripts/verify.sh`

Keep every assertion it already makes, and add assertions for this view:

* `GET /arbeitsmarkt/digest` is **200**;
* the served HTML contains **at least 8** digest entries, each carrying a rank **and** a stated
  reason — assert on the entry markup, not on the page as a whole, so one entry cannot satisfy a
  check meant for eight;
* the served HTML contains the synthetic-data statement;
* the stage counts are present.

Asserting "at least 8" needs the check to count, not to match once. There is a `data-` attribute
convention in this app already (`data-synthetic-statement`, `data-synthetic`); follow it.

### 6. Report the numbers

State in the report: how many listings the dataset holds, how many survive the filter, how many are
rejected and why, and the score range of the top entries. Numbers, not adjectives.

## Acceptance criteria — run these and paste the raw output

* **A-1** `bash scripts/verify.sh` exits 0 and asserts the digest renders at least N entries, each
  with a rank and a stated reason. State N and show the assertion counting.
* **A-2** **Prove the check can fail: empty the dataset, show `verify.sh` failing, then restore it.**
  Paste the failing output. Restore the dataset exactly — the committed file must be byte-identical
  afterwards, and `scripts/ci.sh` green again is the evidence.
* **A-3** The served HTML contains the synthetic-data statement.
* Plus `bash scripts/ci.sh` exits 0 — it includes the Prettier check, so run
  `npm run format:check` before you finish.

## Proving the other new checks can fail

`AGENTS.md` §6. Break the **behaviour or the content, not the types**. A TypeScript error or a Zod
failure stops the build, fails the check for the wrong reason, and proves nothing about the
assertion. The previous Arbeitsmarkt entry records a guard that was named for something it did not
check — do not add another.

At minimum, show the ranking is actually a ranking rather than a reordering: break the score (for
instance, make every component return the same value) and show the assertion that depends on ordering
fail.

## Report what you observe

Say whether the root `README.md` or `src/lib/demos.ts` makes any claim about this app that is now
inaccurate, and whether `docs/SYNTHETIC_DATA.md` needs updating to describe the profile and ranking.
Report; do not edit them.

## About `LESSONS_LEARNED.md`

You may add **one** short dated entry if you learn something genuinely new: a failure, a measurement,
or a behaviour that contradicts documentation. Record the **measurement** — command, observed output,
exit code — not a conclusion.

**Do not record a claim you have not verified in the environment the claim is about.** Two workers
have now recorded a working guard as broken because a restricted sandbox broke it. If a check fails
only under the sandbox, say that it failed under the sandbox and that you did not verify it outside.

## How to report

1. **What you did** — files, the profile and scoring design, and any decision the ticket did not cover.
2. **Acceptance evidence** — each command with raw output, plus a deliberate failure for each new
   assertion, including A-2.
3. **What you did NOT verify.**
4. **The numbers** from item 6.

Do not claim success without pasted command output.
