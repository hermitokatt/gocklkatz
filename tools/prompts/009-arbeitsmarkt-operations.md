# Worker brief — GOC-30 (the operational view: source health and alarms)

You are the **implementer**. A separate orchestrator owns the requirement, reviews your tree, and
authors the commit. Read these first:

1. `AGENTS.md` — the standing contract, especially §1, §2 (public bar), §6 (guards must be seen to
   fail), §7 (never trust a report — verify by running).
2. `LESSONS_LEARNED.md` — the standing lessons, and the three Arbeitsmarkt entries. Two of them are
   about guards that were named for something they did not check.
3. `apps/arbeitsmarkt/` and its `AGENTS.md` — the app, and `docs/ACQUISITION.md` +
   `docs/SYNTHETIC_DATA.md` + `docs/RANKING.md`.
4. `tools/prompts/007-arbeitsmarkt.md` and `008-arbeitsmarkt-digest.md` — the two briefs before this
   one, for the established shape and tone.

The digest shows the happy path. This issue shows what the system does when a source misbehaves,
which the epic calls "the most defensible part of this system".

## Hard rules

* **Do not commit. Do not push. Do not create a branch.** Leave your work in the working tree.
* **Do not edit anything outside `apps/arbeitsmarkt/` except `LESSONS_LEARNED.md` and the root
  `AGENTS.md`**, and read the notes about both before touching them.
* **Do not edit `src/lib/demos.ts`, the root `README.md`, or another app.** Report what is wrong in
  them instead.
* **Do not write machine-local absolute paths**, or patterns from `tools/pii-patterns.txt`, into any
  tracked file.
* **Never copy a directory recursively, and never leave `node_modules`, `.next`, an npm cache or any
  build output where git could track it.**
* **This repository is public.** No secrets, no credentials, no personal names.
* **Do not add a dependency.** If you believe one is missing, stop and say so.
* **No acquisition path, still.** This issue is *about* misbehaving sources, and that makes it the
  easiest place to accidentally build one. Do not add `fetch`, a scraping framework, a browser
  driver, or a "try live, fall back" branch.

## What to build

### 1. Sources are synthetic too — do not name a real service

This is the risk the ticket names: "the easiest place for real data to leak into the demo."

Present fictional sources, in the same spirit as the invented employers and districts already in the
dataset. **Do not name a real job board, a real API, or a real company**, and do not present a real
service as one that is "disabled here" — that is a claim about a third party's terms, it would be a
published statement about a named business, and this demo must not make it.

Instead: a small committed source registry (`data/sources.json` is the natural home), each entry
synthetic and labelled as such, carrying what an operational view needs — a display name built from
the same mechanical word-parts the dataset uses, a status (`permitted` / `disabled` / `quarantined`),
a request budget, and the rule that put it in that state.

Make the source names obviously constructed, following the naming construction already documented in
`docs/SYNTHETIC_DATA.md`, and extend the legend or add a sibling legend entry so the artificiality is
self-evident rather than asserted.

### 2. A pure operational model

Add to `lib/pipeline/` or a sibling pure module. Same discipline as the generator and the ranking:
no clock, no environment, no network. Given the registry and the dataset it must produce a
deterministic operational snapshot.

It must model, at minimum:

* **per-source health**: the timestamps of the last attempt, last success and last failure, and a
  derived health state that a reader can see the basis of;
* **request budget consumption**: the budget, what has been consumed, and what remains — with the
  window the budget applies to stated, not implied;
* **alarms**: a small set of named checks evaluated over that state, each with an id, a human
  description, a severity, and a state (**firing** or **clear**). An alarm that cannot be seen to
  fire is not an alarm — include at least one that fires and at least one that is clear, so the view
  shows both states rather than only the happy one.

### 3. Failure is the interesting part — show what the system does

Requirement 2 is explicit: "a source that returns 403 is backed off and quarantined, and the view
shows that state rather than hiding it."

So the model must implement a **policy** for failure, and the view must show it:

* a source that fails a defined number of times consecutively is **backed off** with a stated
  interval, then **quarantined** with a reason;
* a refused response (403) is a distinct case from a transport failure and is recorded as such;
* the state is **derived from the synthetic records**, not typed in by hand — the view must show the
  state that follows from the data, and a change to the input data must change the output.

Write it as a **policy table** in `docs/OPERATIONS.md`: which condition leads to which state, and
what the system does. Say plainly that this is a demonstration policy, not a production incident
process.

### 4. The operational view

A server-rendered route — `/arbeitsmarkt/operations` is the natural name; say if you choose
otherwise. It must show:

* the sources with their status, health, budget consumption and remaining budget;
* every alarm with its severity and its **firing/clear** state, and for a firing alarm, what it is
  firing about;
* the failure policy: the back-off and quarantine rules, and which sources are in that state now;
* the compliance position **as design, not as a disclaimer**: which sources are permitted, which are
  disabled, and that the rule is enforced in code — point at the code that enforces it;
* the synthetic-data statement.

Server-rendered; no client-side fetching for content.

### 5. Extend `scripts/verify.sh`

Keep every existing assertion, and add:

* `GET /arbeitsmarkt/operations` is **200**;
* the served HTML **names each alarm** by id — every alarm in the model, counted, not one match for
  the page;
* the served HTML contains the synthetic-data statement;
* **A-3: a grep over the served HTML finds no field that could come from a real listing.** Think
  carefully about what this can actually check, and say what you concluded. It cannot mean "no word
  that appears in a real listing", because the demo legitimately renders job titles and company
  names. Make it check something real: for example, that every rendered employer matches the
  synthetic construction, and that no rendered identifier falls outside the synthetic id scheme.
  **A grep that cannot fail is worse than no grep** — see §6 below.

### 6. Also correct a false claim in the root `AGENTS.md`

`AGENTS.md` §4 currently reads:

> **No browser driver, no scraping framework in any app runtime.** | Measured and rejected; see
> `apps/arbeitsmarkt/docs/` for the evidence.

The evidence it points at says the opposite:

> No separate performance benchmark of browser drivers was run for this ticket.

Two documents in a public repository contradict each other, and the one making the stronger claim is
the one with no measurement behind it. That matters here because this repository's rule is that a
claim without provenance is not a claim.

Correct `AGENTS.md` §4 to say what is actually true and verifiable: browser drivers and scraping
frameworks are rejected because the shipped demo acquires nothing, and because installing them would
put an acquisition tool into a repository whose rule is that no acquisition happens here. Keep the
pointer to `apps/arbeitsmarkt/docs/`, which does hold that reasoning.

**Do not invent a benchmark to make the current wording true.** If you think a measurement would
strengthen the rule, say so in your report — do not fabricate one.

## Acceptance criteria — run these and paste the raw output

* **A-1** `bash scripts/verify.sh` exits 0 and asserts the operational view renders and **names each
  alarm**. Show the assertion counting alarms.
* **A-2** A test drives a synthetic source failure and asserts the resulting state is displayed.
  Paste the test output, and the deliberate failure of that assertion.
* **A-3** A grep over the served HTML finds no field that could come from a real listing. State what
  your grep checks and show it failing when the condition is broken.
* Plus `bash scripts/ci.sh` exits 0 (it includes the Prettier check — run `npm run format:check`).

## Proving a check can fail

`AGENTS.md` §6. Break the **behaviour or the content, not the types**. A TypeScript error or a Zod
failure stops the build, fails the check for the wrong reason, and proves nothing about the
assertion. Two previous entries in `LESSONS_LEARNED.md` are about exactly this, and one is about a
guard whose name promised more than its regex checked.

For the operational view, a good break is to make the failure policy a no-op, so a source that should
be quarantined stays healthy — then the assertion that depends on the quarantined state must fail.

**If a break fails something earlier than the assertion you are testing, fix the fixture until it
reaches the assertion.** `ok build` immediately before the FAIL is the signal that the right check
fired.

## About `LESSONS_LEARNED.md`

You may add **one** short dated entry if you learn something genuinely new. Record the
**measurement** — command, observed output, exit code — not a conclusion.

**Do not record a claim you have not verified in the environment the claim is about.** Three workers
have now recorded a working check as broken because a restricted sandbox broke it. If a check fails
only under the sandbox, say that it failed under the sandbox and that you did not verify it outside.

## How to report

1. **What you did** — files, the source registry and the failure policy, and any decision the ticket
   did not cover.
2. **Acceptance evidence** — each command with raw output, plus a deliberate failure for each new
   assertion.
3. **What you did NOT verify.**
4. **What your A-3 grep actually checks, and what it cannot.**
5. **The `AGENTS.md` §4 correction**, quoted before and after.

Do not claim success without pasted command output.
