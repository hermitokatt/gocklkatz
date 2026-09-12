# Worker brief — GOC-19 (add apps/bienenstock with a 3D scene)

You are the **implementer**. A separate orchestrator owns the requirement, reviews your tree, and
authors the commit. Read these first:

1. `docs/tickets/003-bienenstock.md` — the scope for this app.
2. `AGENTS.md` — the standing contract, especially §1 (identity), §2 (public bar), §6 (guards must
   be seen to fail) and §7 (verify by running).
3. `LESSONS_LEARNED.md` — read the "Standing lessons" list. This brief repeats the parts that
   matter, but that file is the reason they matter.
4. `apps/ameisenwerkstatt/` — the app built immediately before this one. **Match its shape** for
   `scripts/ci.sh`, `scripts/verify.sh`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
   `vitest.config.mts`, `.prettierrc.json` and the `repo.config` entry. **Do not copy its code.**
   Its `three` usage is the reference for the rendering family, nothing more.

This is a **greenfield build**. There is no existing Bienenstock application to import. You are
building a new app that has never existed.

## Hard rules

* **Do not commit. Do not push. Do not create a branch.** Leave your work in the working tree.
* **Do not edit any ticket, and do not edit `repo.config`'s existing entries** — add one block for
  this app and change nothing else there.
* **Do not edit the root landing page, `apps/ameisenwerkstatt` or `apps/simplified`.**
* **Do not write machine-local absolute paths or the patterns from `tools/pii-patterns.txt` into
  any tracked file.** The guard blocks them. Use repository-relative paths.
* **Never copy a directory recursively into this repository.** Importing the previous app by
  copying its working directory dragged in `node_modules` and build output **twice** — 24,047 and
  22,319 files. Here there is nothing to import, so the rule is simply: never copy `node_modules`,
  `.next`, or any build output anywhere, and make sure `git status` shows none of it as tracked.
* **This repository is public.** No secrets, no credentials, no personal names.
* **No browser driver and no scraping framework.** `playwright` is allowlisted but not installed;
  do not install it.

## What to build

### 1. A self-contained app at `apps/bienenstock`

Its own `package.json`, `package-lock.json`, `scripts/ci.sh`, TypeScript strict, Vitest, ESLint,
Prettier. There are **no npm workspaces** — do not hoist anything to the root and do not import
from another app.

Dependencies: only what is already on `docs/DEPENDENCY_ALLOWLIST.md`. `three` (`^0.180.0`) and
`@types/three` (`^0.180.0`) are already allowed for runtime and dev. Match
`apps/ameisenwerkstatt/package.json` for the rest. **You are not adding a package** — if you think
you need one that is not on the allowlist, stop and say so instead of editing the allowlist.

Use **port 43126**. 43123 is Ameisenwerkstatt, 43124 the landing page, 43125 Simplified.

Run `npm install` to produce `package-lock.json` and `node_modules`. The lockfile is committed;
`node_modules` is not.

### 2. Route `/bienen` rendering a 3D scene

`three`, same family as Ameisenwerkstatt (`three` plus `OrbitControls` from `three/addons`). The
scene must contain:

* **A recognisable hive.** A woven skep is the shape a visitor reads as a beehive — stacked coils
  tapering into a dome, with a visible entrance. It should be identifiable from the default
  camera without a label.
* **Surrounding nature.** Ground, vegetation, and a sky. Trees, flower patches and grass are the
  obvious vocabulary. Use instancing for anything repeated at scale (grass, flowers, trees, bees)
  rather than one mesh per blade.
* **Lighting that makes it read as outdoors** — a sun with shadows plus ambient fill, so the
  shaded side of the hive is legible rather than black.

**This is judged on how it looks.** It is a portfolio piece, not a chart. A technically correct
scene that is a grey box on a grey plane does not pass.

### 3. A camera the visitor can move

Orbit is the choice; state in `docs/` or `README.md` **why** orbit rather than walk. It must be
usable **without a keyboard** — pointer drag and wheel, at minimum. Constrain the polar angle so
the camera cannot go under the ground, and clamp the zoom distance.

### 4. It must not be blank, and it must not error

* The page must render **without console errors**.
* The canvas host element must be **present in the server-rendered HTML**, before any JavaScript
  runs, carrying the attribute `data-bienen-scene`. This is what makes the app verifiable without a
  GPU. Do not mount the container from inside an effect; put it in the JSX.
* If WebGL is unavailable, or the scene module fails to load, **say so in the UI** rather than
  leaving an empty panel.

There is a second trap worth knowing about, and it is recorded in
`apps/ameisenwerkstatt/lib/ameisen/canvas-display.ts`: sizing a canvas from
`getBoundingClientRect()` while letting the renderer also write the canvas's pixel size creates a
feedback loop with `ResizeObserver`, and the canvas grows without bound. Position the canvas
absolutely, size it with CSS, and pass `false` as the third argument to `renderer.setSize`.

### 5. `scripts/ci.sh` that stands itself up

It must run `npm ci` when `node_modules` is not already present, then lint, typecheck, test and
build — the way `apps/ameisenwerkstatt/scripts/ci.sh` does. A fresh clone has no `node_modules`,
and a gate that assumes one fails for a reason that has nothing to do with the app.

### 6. `scripts/verify.sh` that proves the app RUNS

Copy the *shape* of `apps/ameisenwerkstatt/scripts/verify.sh`: build, start the server, wait for the
port rather than assuming it, probe, always shut down, assert the port was released, and fail
cleanly if the port is already bound.

It must assert:

* `GET /bienen` is **200**, and
* the served HTML contains `data-bienen-scene`, **and**
* the served HTML contains a string the page actually renders — assert on real content, not just
  the attribute.

**Do not assert on the status code alone.** A 200 is answered by error pages and by empty shells.
This exact mistake has already shipped in this repository and had to be fixed afterwards.

**Prove your check can fail.** `AGENTS.md` §6: a guard that has never been seen to fail is not a
guard. Break the content assertion deliberately (for example, remove the marker from the page while
it still answers 200), paste the failing output, then revert. Break the **content**, not the types:
a TypeScript error or a Zod schema failure stops the build, which fails the check for the wrong
reason and proves nothing about the assertion. That is recorded in `LESSONS_LEARNED.md` and cost
three attempts the last time.

### 7. Register the app in `repo.config`

`enabled: true`, `verify_cmd: bash scripts/verify.sh`. Match the existing blocks exactly — a
previous edit produced a duplicated block that the gate then reported twice.

### 8. Record the port

Add the app's verify port to the table in `docs/DEPLOY.md` next to 43123, 43124 and 43125.

## What NOT to do in this piece

Bee agents, foraging behaviour, nectar, and the visitor interactions are **separate issues in this
epic**. Do not implement them. A static scene with a movable camera is the whole of this ticket.

You may leave hooks for them — a `lib/bienen/` module structure that a later issue extends is
good — but do not build the simulation.

**Not your job:** creating the Vercel project or attaching a domain. Say so rather than claiming
the demo is live.

## Acceptance criteria — run these and paste the raw output

* **A-1** `cd apps/bienenstock && bash scripts/ci.sh` exits 0.
* **A-2** `bash tools/gate.sh` exits 0 and reports `bienenstock` running and serving.
* **A-3** `node tools/check-deps.mjs` exits 0.
* **A-4** The served `/bienen` HTML contains the scene container `data-bienen-scene`.

Plus the deliberate-failure proof described in item 6.

## How to report

1. **What you did** — files created, and any decision the ticket did not cover.
2. **Acceptance evidence** — each command above with its raw output, and the deliberate-failure
   proof.
3. **What you did NOT verify.**
4. **The camera choice**, with your reason for orbit or walk.

Do not claim success without pasted command output. If something does not work, say what you
observed rather than describing what you intended.
