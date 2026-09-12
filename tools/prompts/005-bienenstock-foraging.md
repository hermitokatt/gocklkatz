# Worker brief — GOC-20 (simulate bee agents foraging)

You are the **implementer**. A separate orchestrator owns the requirement, reviews your tree, and
authors the commit. Read these first:

1. `AGENTS.md` — the standing contract, especially §1 (identity), §2 (public bar), §6 (guards must
   be seen to fail) and §7 (verify by running).
2. `LESSONS_LEARNED.md` — the standing lessons list, and the two dated entries. The mistakes
   recorded there have each already cost this repository a full cycle.
3. `apps/bienenstock/` — the app you are extending. `lib/bienen/scene.ts` draws the world;
   `scripts/ci.sh` and `scripts/verify.sh` are its gates.
4. `apps/ameisenwerkstatt/lib/ameisen/` — the shape a pure simulation module takes in this
   repository: deterministic RNG, plain data, no `three`, no DOM, unit-tested in Node. **Do not
   copy its code.**

The previous issue built a static scene with a movable camera. This one makes it a colony.

## Hard rules

* **Do not commit. Do not push. Do not create a branch.** Leave your work in the working tree.
* **Do not edit `docs/tickets/`, `repo.config`, `docs/DEPLOY.md`, or any file outside
  `apps/bienenstock/`** except `LESSONS_LEARNED.md`, and read the note about that file at the end.
* **Do not write machine-local absolute paths**, or the patterns from `tools/pii-patterns.txt`,
  into any tracked file.
* **Never copy a directory recursively, and never leave `node_modules`, `.next`, an npm cache, or
  any build output where git could track it.** Two earlier runs dragged in 24,047 and 22,319 files
  this way. Check `git status` before you finish.
* **This repository is public.** No secrets, no credentials, no personal names.
* **Do not add a dependency.** Everything needed is already on
  `docs/DEPENDENCY_ALLOWLIST.md`. If you believe something is missing, stop and say so rather than
  editing the allowlist.

## What to build

### 1. A pure simulation core in `lib/bienen/`

It must import nothing from `three` and touch no DOM, so that a Node test can run thousands of
steps in milliseconds. The renderer is a **reader** of simulation state, never a participant.

**Time is simulated, not wall-clock.** `step(dt)` advances by whatever `dt` it is given, so a test
can run ten minutes of colony time without waiting ten minutes.

### 2. Bee agents with visible individual behaviour

Many bees, **count configurable**. Each bee leaves the hive, travels to a flower patch, collects,
and returns. States such as in-hive / outbound / foraging / returning are expected, with the bee's
position and altitude available to the renderer.

The existing scene already draws the world from `lib/bienen/`; extend that rather than replacing
it. Keep the world description and the simulation separable — the world is the stage, the colony is
the action.

### 3. Foraging is not random wandering

A bee's choice of patch must be influenced by **what it has learned and by what other bees are
doing**, so the colony's distribution across patches is legible over time rather than noise. What
that means concretely is your decision, but it must be:

* **explainable in one sentence** in the app's `README.md` or `docs/`, and
* **assertable**, not merely decorative — a test must be able to observe the colony concentrating
  on a richer patch.

Recruitment or a preference for nectar-rich patches are both reasonable; what is not acceptable is
a uniform random choice dressed up as a model. If you implement something that only *looks* like
foraging, say so plainly rather than implying it is a validated model.

### 4. Deterministic given a seed

`Math.random` must not appear anywhere in the simulation. The app already has a seeded generator in
`lib/bienen/`; use it, and keep a single source of randomness. The same seed and the same number of
steps must produce **identical** state.

Beware the draw order: inserting a new random draw above existing ones changes every seeded run
after it. Do not reorder existing draws.

### 5. Render the colony

Draw the bees in the existing scene, positioned from simulation state. Bees fly above the ground;
they should read as a swarm with individual movement, not as a grid. Use instancing — a few hundred
individual meshes will not hold a frame rate.

### 6. Report the frame rate, measured

Acceptance criterion A-3 requires the **default agent count** and an **observed frame rate at that
count**. Measure it; do not estimate it and do not claim a number you did not see. State the machine
and how you measured it, and say plainly if you measured it in a headless environment or not at all.
The scene already displays a frame-rate readout — use it, or say why it is not representative.

If the frame rate is poor at a count you wanted, reduce the default and say so. An honest lower
number is worth more than a target you did not meet.

## Tests you must add

* A **determinism test**: the same seed and step count produces identical state, asserted, not
  described. Print or paste something that identifies both runs so a reader can see they matched.
* A test that the colony **concentrates** on a richer patch rather than spreading uniformly.
* Tests for the state machine: a bee that leaves returns; collecting reduces what a patch holds and
  increases what the hive holds; a bee never carries more than its capacity.

## Acceptance criteria — run these and paste the raw output

* **A-1** `cd apps/bienenstock && bash scripts/ci.sh` exits 0, including the deterministic
  simulation test.
* **A-2** The same seed twice produces identical state after N steps, asserted in a test, with the
  output pasted.
* **A-3** The report states the default agent count and the measured frame rate at that count.

Also: `bash tools/gate.sh` must exit 0 and report `bienenstock` running and serving.

## Proving a check can fail

`AGENTS.md` §6. For the **new** assertions you add, show at least one failing deliberately and paste
the output, then revert.

Break the **content or the behaviour, not the types**. A TypeScript error or a Zod schema failure
stops the build, which fails the check for the wrong reason and proves nothing about the assertion.
This exact mistake is recorded in `LESSONS_LEARNED.md` and cost three attempts the last time.

## About `LESSONS_LEARNED.md`

You may add **one** dated entry if you learn something genuinely new: a failure, a measurement, or a
platform behaviour that contradicts what its documentation says. Keep it short, and record the
**measurement** — the command, the observed output, the exit code — rather than a conclusion.

**Do not record a claim you have not verified in the environment the claim is about.** A previous
worker recorded that the guard's secret scan was a silent no-op, based on evidence from inside a
restricted sandbox. It was wrong: the scan works, and what the sandbox broke was `xargs`. A wrong
lesson in a public journal is worse than no lesson, because the next reader acts on it.

## How to report

1. **What you did** — files, and any decision the ticket did not cover.
2. **Acceptance evidence** — each command with raw output, plus the deliberate-failure proof.
3. **What you did NOT verify.**
4. **The default agent count and the measured frame rate**, with how you measured it.

Do not claim success without pasted command output.
