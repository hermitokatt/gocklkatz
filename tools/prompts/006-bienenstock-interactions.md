# Worker brief — GOC-21 (nectar spike and hive disturbance)

You are the **implementer**. A separate orchestrator owns the requirement, reviews your tree, and
authors the commit. Read these first:

1. `AGENTS.md` — the standing contract, especially §1 (identity), §2 (public bar), §6 (guards must be
   seen to fail) and §7 (verify by running).
2. `LESSONS_LEARNED.md` — the standing lessons, and the two dated Bienenstock entries. Read the one
   about **collected share not being a choice metric**, and the one about **breaking behaviour, not
   types**.
3. `apps/bienenstock/` — the app. `lib/bienen/colony.ts` is the pure simulation;
   `docs/FORAGING.md` describes the foraging model; `scripts/ci.sh` and `scripts/verify.sh` are the
   gates.
4. `apps/bienenstock/AGENTS.md` — app-specific rules that are easy to break.

The colony forages on its own. This issue lets a visitor **disturb** it and watch it respond.

## Hard rules

* **Do not commit. Do not push. Do not create a branch.** Leave your work in the working tree.
* **Do not edit anything outside `apps/bienenstock/`**, except `LESSONS_LEARNED.md` — see the note at
  the end before touching it.
* **Do not write machine-local absolute paths**, or patterns from `tools/pii-patterns.txt`, into any
  tracked file.
* **Never copy a directory recursively, and never leave `node_modules`, `.next`, an npm cache or any
  build output where git could track it.** Two earlier runs dragged in 24,047 and 22,319 files. Check
  `git status` before you finish.
* **This repository is public.** No secrets, no credentials, no personal names.
* **Do not add a dependency.** If you believe one is missing, stop and say so.

## What to build

### 1. The simulation core owns the behaviour; the UI only triggers it

Both interactions must be implemented in `lib/bienen/colony.ts` (or a sibling pure module) as
**functions on colony state**, and unit-tested there. The React component calls them and does nothing
else. A test must be able to drive an interaction with no DOM and no renderer.

`lib/bienen/colony.ts` must stay free of `three` and the DOM, and `Math.random` remains forbidden.

### 2. Nectar spike

The visitor **boosts or drops a chosen flower patch's nectar**. Bees already foraging must
**reallocate toward or away from it**, and the change must be visible within a **short, stated
time**.

* Choose the target patch however is clearest — a patch picker in the UI is fine, or "the patch under
  the cursor" if you prefer, but say which and make it reachable without a keyboard.
* "A short, stated time" means you name a number — for example "the share of bees working the boosted
  patch rises within 20 simulated seconds" — and a **test asserts it**.
* Dropping a patch's nectar to zero is a legitimate spike; the colony must leave it and not starve
  the run. Think about what happens when every patch is empty.

### 3. Hive disturbance

The visitor disturbs the hive. The colony **scatters and then re-homes**, and the re-homing
**completes** — the scene must not be left permanently disrupted.

* A test must drive a disturbance and assert the colony returns to a stable foraging state **within a
  stated number of steps**, and that test must be meaningful: assert on something that would still
  be true if the colony never recovered, so that a model with no re-homing fails it.
* Say what "disrupted" and "recovered" mean measurably — for example the number of bees away from the
  hive, or the colony's spread — and use those in the test.

### 4. Both are deterministic under a seed

Same seed, same interaction at the same simulated time, same result. No wall-clock time and no
`Math.random` anywhere in the interaction paths. Assert it, the way the existing determinism test
does.

### 5. Both are reachable without a keyboard, and labelled on screen

Every control is a real `<button>` (or equivalent), focusable and operable by pointer **and**
keyboard, with a visible text label. No icon-only buttons with no accessible name. The visitor must
be able to tell what each control does and which patch it applies to.

### 6. Report the effect honestly

State in `README.md` or `docs/` what each interaction does to the model, and **what the measured
effect was** — the numbers from your test run, not an adjective. If an interaction turns out to be
subtle, say so rather than claiming a dramatic response.

## Tests you must add

* Nectar spike: the distribution across patches **shifts in the expected direction**, with the numbers
  printed so a reader can see the shift.
* Disturbance: the colony returns to a stable foraging state within a stated number of steps.
* Determinism: the same seed and the same interaction script produce identical state.
* Whatever the recovery test needs to be non-vacuous — show it failing if recovery never happens.

## Acceptance criteria — run these and paste the raw output

* **A-1** A test drives a nectar spike and asserts the distribution across patches shifts in the
  expected direction. Paste the output.
* **A-2** A test drives a disturbance and asserts the colony returns to a stable foraging state
  within a stated number of steps. Paste the output.
* **A-3** `bash tools/gate.sh` exits 0 with the app present.

Also: `bash scripts/ci.sh` must exit 0, and it now includes a **Prettier check** — run
`npm run format:check` before you finish, or `ci.sh` will fail on formatting.

## Proving a check can fail

`AGENTS.md` §6, and this is where the last two workers lost time. For **each new assertion**, show it
failing deliberately and paste the output, then revert.

**Break the behaviour, not the types.** A TypeScript error or a Zod failure stops the build, fails
the check for the wrong reason, and proves nothing about your assertion. The recorded mistake: to
break a determinism test, a `Math.random()` call was added — the *source scan* caught it while the
determinism test itself stayed green, so the run proved something real but not the thing intended.

A good way to break an interaction assertion is to make the interaction do nothing at all, and
confirm the test then fails naming the effect it expected.

## About `LESSONS_LEARNED.md`

You may add **one** short dated entry if you learn something genuinely new. Record the
**measurement** — command, observed output, exit code — not a conclusion.

**Do not record a claim you have not verified in the environment the claim is about.** A previous
worker recorded that the guard's secret scan was a silent no-op, based on its sandbox; the scan works
and the sandbox was what broke. That correction is itself an entry in the file. A wrong lesson is
worse than no lesson.

## How to report

1. **What you did** — files, and any decision the ticket did not cover.
2. **Acceptance evidence** — each command with raw output, plus a deliberate failure for each new
   assertion.
3. **What you did NOT verify.**
4. **The two interactions, stated measurably** — what each changes, and how much, with numbers.

Do not claim success without pasted command output.
