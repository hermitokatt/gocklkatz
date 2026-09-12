# Lessons learned

A working journal. Newest entries at the bottom. Add an entry when something is learned the hard
way — a failure that has now happened twice, a check that turned out not to check anything, a
platform behaviour that contradicts what the documentation claims.

**Why this file exists.** Working sessions are long and get compacted. When that happens the
reasoning behind a decision is lost first, and the same mistake gets made again. A note here
survives compaction, and survives the session entirely.

**What belongs here.** Findings that were measured rather than assumed, with the evidence. Failures
with their cause. The reason a rule exists, when the rule alone does not say.

**What does not.** Anything forbidden by [`AGENTS.md`](./AGENTS.md) §2 — this file is public. No
absolute paths (`$HOME` in prose), no secrets, no values from `.env`, no identity other than
Hermito Katt / Gocklkatz Inc. `tools/guard.sh` will refuse the commit.

**Not a to-do list.** Open work belongs in the issue tracker. This records what has already been
learned.

---

## Standing lessons

Distilled from the entries below, newest first. Read this list before starting work; read the entry
when a rule seems arbitrary.

1. **An agent's report is not evidence.** Every claim gets checked by running the thing. Reports
   have been wrong about the tree, the tests, and the deployment, in good faith.
2. **A guard that has never been seen to fail is not a guard.** Break the thing deliberately, watch
   the check fail, revert it, and record the output. This has caught three separate checks that were
   silently passing on a 200.
3. **Import from a tracked file list, never from a working directory.** Two workers have now copied
   `node_modules` and build output into this repository. Give workers work that does not involve
   recursive copies.
4. **Merge locally. Never use the platform's merge button.** Both merge commits and squashes are
   attributed to the account that pressed it, and this has put a foreign identity into published
   history.
5. **A 200 is not a pass.** Status codes are answered by error pages, by empty shells, and by the
   wrong application. Assert on content or on the health payload's identity.
6. **Check what the *served* surface says, not what the source says.** The source can be right, the
   build can pass, and the deployed route can still answer with a login wall.
7. **Verify the shape of a config flag.** A flag that parses but changes nothing is worse than no
   flag, because it reads like a control.
8. **Write down the measurement, not the conclusion.** "Deployment URLs are private" is a
   conclusion; "the project alias answers `302` to an auth host" is a fact that can be rechecked.

---

## 2026-09-12 — Simplified (epic GOC-23)

Brought the Simplified app into the monorepo, recorded its data provenance, put it under the gate,
and deployed it. Four sub-issues (GOC-24, GOC-25, GOC-45, GOC-26), four pull requests, all merged
locally.

### A worker copied `node_modules` for the second time

The brief warned explicitly, with the file count from the previous occurrence. The worker still
copied the working directory: **22,319 files, 536 MB**. The first time was Ameisenwerkstatt at
24,047 files / 601 MB.

*Cause:* importing an application is naturally phrased as "copy the app here", and a worker with a
shell will reach for `cp -R`.

*What worked:* import from the tracked file list instead, in the orchestrator, not the worker.

```bash
git -C "$HOME/Repos/simplified" ls-files -z | tar --null -T - -cf - | tar -xf - -C apps/simplified
```

That produced exactly the 39 tracked files, 476K. Then apply the worker's edits by hand.

*Rule:* do not give a worker a recursive copy. Give it the file list, or do the copy yourself.

### Recovering an edited tree without losing the edits

After discarding the polluted directory, the worker's four useful edits still existed in the
rescued copy. Compare file lists to find them — a file present in the copy but absent from
`git ls-files` is **new**, not edited, and a naive diff of only the shared files misses it. That is
how `scripts/verify.sh` (new, 241 lines) was almost lost.

*Also:* `git ls-files` tracks what git knows about. `tsconfig.tsbuildinfo` and `next-env.d.ts` are
gitignored build artifacts that appear on disk after any build; they are not part of an import and
must not be committed. Count files against the tracked list rather than trusting `find`.

### A worker added a config flag nobody asked for

The brief asked to pin Next's workspace root. The worker also added `allowedDevOrigins` populated
from every non-internal IPv4 on the machine. Harmless in effect — the setting is dev-only — but it
published the development machine's network addresses in a public repository, and the app's README
had been updated to advertise the behaviour.

*Leaving it* would have meant a public document describing a control that exists. Removing it meant
the README line became false, so both had to change together. When you delete a config flag, grep
the docs for its name.

### The `/api/health` check accepted any app

Every app in this monorepo answers `{"ok": true, ...}`. The Simplified verify script asserted
`ok is true` and nothing else, so Ameisenwerkstatt answering on that port would have passed. The
health payload carries a `service` name precisely so this is checkable.

*Now:* assert `service == "<this app>"`. Applied in `apps/simplified/scripts/verify.sh`.

### Making a check fail, when the app is built to reject bad input

Getting the content assertion to fail took three attempts, and the first two are instructive.

1. Renamed the route handler's export. Failed at **build**, not at the check — TypeScript caught it.
2. Returned `ok: false` from the health function. The **Zod schema** rejected it at runtime, so the
   route answered 500 rather than a wrong 200. Still not the check failing.
3. Dropped one radical from the seed, leaving 44 entries — inside the 30–50 the schema allows. The
   app built, `/learn/radicals` answered **200**, and the content assertion reported:

```
route GET /learn/radicals         200
    FAIL  GET /learn/radicals did not answer 200 with rendered component content (got 200)
```

*Lesson:* schemas and type checks are upstream of the assertions you are trying to test. To exercise
an assertion, break the data, not the types — and stay inside every validation range on the way.

### `ssoProtection: all_except_custom_domains` is the whole story

Vercel reports several addresses per project and only one is public. For the Simplified project:

| Address | Fetched anonymously |
| --- | --- |
| `gocklkatz-simplified.vercel.app` (attached custom domain) | `200` |
| `gocklkatz-simplified-gocklkatz.vercel.app` (project alias) | `302` to `vercel.com/sso-api` |
| `gocklkatz-simplified-git-main-gocklkatz.vercel.app` (branch alias) | `302` |

The **default** domain a project gets is `<project>-<team>.vercel.app`, which is *not* the custom
domain and therefore *not* public. The address on the card is `gocklkatz-simplified.vercel.app`,
which is a separately attached custom domain. Do not assume a project is reachable because the build
succeeded — fetch the exact URL, and check whether a `302` goes to an auth host.

*Correction to an earlier assumption in this repository:* the docs said attaching a domain is a
human UI step because the Vercel MCP exposes no domain-attach tool. The tool list was read
correctly — there is no `attach_domain` — but the domain was already attached when the project was
created, so no UI step was needed. Check the project's domain list before telling a human to act.

### The Vercel MCP is reachable through `cursor-agent`, not from the shell

`cursor-agent mcp` only offers `login`, `list`, `list-tools`, `enable`, `disable` — no way to call a
tool. A headless run can:

```bash
cursor-agent -p --model auto --force "Use the vercel MCP tool list_projects ... report raw output"
```

Confirmed working for `list_projects`, `create_git_project`, `get_project` and
`get_project_deployment_protection`. Keep the prompt read-only unless a change is intended, and ask
for raw tool output rather than a summary.

### A pre-existing document bug that nobody had noticed

`docs/DEPLOY.md`'s live-URL table had `—` for **every** project, including the landing page and
Ameisenwerkstatt, both live for some time. A table that is empty uniformly reads as "nothing is
deployed yet" rather than "nobody filled this in", so it never got fixed.

*Rule:* when a document has a column that is supposed to hold fetched values, an empty cell should
mean "not fetched yet" and be visible as a gap. Fill it in the same change that makes the value
true.

### Linear API gotchas

* Filtering issues by both `team` and `identifier` together returns `HTTP 400`. Query one issue at a
  time by identifier, or list the team and filter locally.
* Moving an issue to the `Duplicate` state fails silently through `issueUpdate` — a duplicate needs
  the duplicate-of relation set. Use `Canceled` and say why in a comment.
* `issueUpdate` succeeds with a comment attached separately. Post the comment even when the state
  change is obvious: the comment is what a reader in six months will have.

---

## 2026-09-12 — Bienenstock scene (GOC-19)

Greenfield `apps/bienenstock`: outdoor skep scene with orbit camera, `scripts/ci.sh` /
`scripts/verify.sh`, `repo.config` entry, verify port 43126.

### Content assertion must fail on a wrong 200, not on a type error

To prove `scripts/verify.sh` asserts content (not status alone), the footer marker `Woven skep`
was renamed while the page still answered 200 with `data-bienen-scene`. Observed:

```
route GET /bienen                 200
    FAIL  GET /bienen did not answer 200 with scene host and rendered content (got 200)
```

exit 1. Reverted. Breaking types or Zod would have failed the build and proved nothing about the
content check — same lesson as Simplified (GOC-23).

### npm install needed a workspace-local cache

The default user npm cache refused writes (`EPERM` on `_cacache/tmp`). `npm install --cache
$PWD/.npm-cache` inside the app directory succeeded; the cache directory was removed afterwards
and never tracked. This is a sandbox restriction, not a project one, and is recorded only so the
next sandboxed run recognises it instead of debugging it again.

### A sandboxed worker can make a working guard look broken

Inside the restricted worker sandbox, `bash tools/gate.sh` reported `bienenstock` ci + verify green
but `GATE: FAIL` overall, for two reasons that had nothing to do with the work:

1. `tests/guard.test.sh` failed its `secret-shaped value is caught` case.
2. The landing-page verify could not reach the live card URLs (`CONNECT tunnel failed, response
   403` for `*.vercel.app` under the sandbox proxy).

**The first was investigated and is not a defect.** An earlier draft of this entry concluded that
the secret scan was a silent no-op, on the evidence that `xargs -0 grep` printed
`xargs: sysconf(_SC_ARG_MAX) failed`. That conclusion was wrong, and it is exactly the kind of
claim that should not be left in a public record. Re-run outside the sandbox:

```
$ bash tests/guard.test.sh
  ok   secret-shaped value is caught (exit 1, reported by name)
guard self-test: 13 passed, 0 failed, 0 skipped

$ printf 'DEEPSEEK_API_KEY=sk-0000...\n' > zz-guard-probe.txt && bash tools/guard.sh --paths zz-guard-probe.txt
guard: secret-shaped value detected:
    1:DEEPSEEK_API_KEY=sk-0000...
guard: FAILED            # exit 1
```

The scan works. What the sandbox broke was `xargs`, which is a real fragility in the guard's
implementation rather than in its logic — and it fails **closed** (it reports a finding even when
the scan cannot run), which is the safe direction.

`bash tools/gate.sh` on the same tree, outside the sandbox: `GATE: PASS (tree 4770f2ee, 4 app
block(s))`.

*Rule:* a sandboxed environment can fail a guard for reasons the guard's own logic never sees.
Before recording that a check is broken, re-run it in the environment the check is meant for. A
wrong lesson is worse than no lesson, because the next reader acts on it.

---

## 2026-09-12 — Bienenstock foraging (GOC-20)

Colony simulation: seeded `step(dt)`, recruitment toward richer patches, instanced bees.

### Collected share is not a choice metric when collect rate scales with richness

To prove the concentration assertion can fail, `choosePatch` was replaced with a uniform
`colony.rng()` draw (not `Math.random`, which a source-scan test would have caught first). The
app still built. Observed:

```
concentration seed=11 steps=2400 richVisits=270 poorVisits=223 richCollected=270.000 poorCollected=43.514 richShare=0.861
AssertionError: expected 270 to be greater than 446
```

exit 1. `richShare` stayed 0.861 because `collectRate * richness` drains the rich patch faster
even when visits are nearly even. The visits assertion is what failed. Reverted.

A test that only asserted collected share would have stayed green on uniform choice.

### Chrome's virtual time does not advance `requestAnimationFrame`

The scene has one canvas readout showing bee count, frame rate and hive nectar. Measuring the frame
rate with the obvious tool failed:

```
$ chrome --headless=new --virtual-time-budget=12000 --dump-dom http://127.0.0.1:43129/bienen
  readout: 120 bees · measuring fps · hive 0.0 nectar
```

`--virtual-time-budget` advances timers, not the rendering loop. The animation never ran, so the app
reported `measuring fps` forever and the hive read 0.0 — a working scene that looks broken, and a
conclusion ("WebGL is unavailable headlessly") that would have been wrong.

Driving Chrome over the DevTools protocol with **real** elapsed time gives the truth on the same
machine:

```
$ node tools/measure-fps.mjs http://127.0.0.1:43129/bienen 15
{ "readout": "120 bees · 60 fps · hive 142.7 nectar",
  "renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)",
  "consoleErrors": [] }
```

The script is at `apps/bienenstock/tools/measure-fps.mjs`, committed so the number in the README can
be reproduced rather than believed.

*Rule:* when a headless measurement reports that a graphical feature is unavailable, check the
measurement method before believing the finding. A probe that cannot run the code under test will
happily report it as broken.

### A stalled worker looks like a busy one from the outside

The GOC-20 worker's connection dropped mid-run and `cursor-agent` entered a reconnect loop. The
process stayed alive and the connection kept being retried, so anything watching only for the process
to exit saw a worker that had been "running" for 30 minutes at **0% CPU** with no file modification
for 2 minutes.

The tree it had already written was complete and its tests passed, so the work was salvaged rather
than re-run. But the stall cost the wall-clock time, and the only thing that identified it was
watching the filesystem rather than the process.

*Rule:* "the process is alive" is not "the process is working". For a long autonomous run, watch file
modification time and CPU, not liveness.

### The gate validates a commit, not a working tree — and says nothing about which

`tools/gate.sh` computes its report path from `git rev-parse HEAD^{tree}`. On a dirty tree that is
the **previous commit's** tree, and the run reports `GATE: PASS` for content it never looked at.

Observed while reviewing GOC-20: after formatting the app, adding `format:check` to `ci.sh` and
adding a measurement script, a gate run reported

```
GATE: PASS (tree ac043e67..., 4 app block(s))
```

and `ac043e67` was the tree of the **pre-review** commit. The staged content was `7171f089`. Both
hashes are printed in their own runs, so the mismatch is visible — but only to a reader who compares
them, which is exactly the reader the pass line discourages.

Whoever runs it is not misled for long: `HEAD` moves on commit and the next run keys on the new
tree, and `.githooks/pre-push` refuses a push with no report for the tree being pushed. So this is a
correctness-of-report problem rather than a hole.

*Rule:* commit first, then gate. If you gate a dirty tree, read the `tree:` line and confirm it is
the tree you mean to ship. A pass is a statement about one tree, and the gate names which.

---

## 2026-09-12 — Bienenstock interactions (GOC-21)

Nectar spike and hive disturbance as functions on colony state, with labelled on-screen controls.

### A position bump is not a determinism break if the stepper overwrites it

To prove the new interaction-determinism test can fail, a module counter was added inside
`disturbHive` and then `bee.x += disturbNonce * 1e-6` after `beginLeg`. The test stayed green:

```
interaction-determinism seed=37 bees=40 runA=10215:53de2984 hiveA=70.610000
  runB=10215:53de2984 hiveB=70.610000
```

exit 0. `fly()` writes `bee.x` from `fromX`/`toX`/`progress` on the next `step`, and the test
fingerprints state after ten more simulated seconds, so the bump was gone. `Math.random` was not
used — a source scan would have caught that first, which is the recorded GOC-20 failure mode.

Adding `colony.hive.nectar += disturbNonce` instead (a field `step` does not overwrite) failed
the assertion on the fingerprints it prints:

```
runA=10215:491a4fa4 hiveA=71.610000 runB=10215:90d9e3e5 hiveB=72.610000
AssertionError: expected '10215:491a4fa4' to be '10215:90d9e3e5'
```

exit 1. Reverted. The break has to survive until the snapshot the test actually compares.

### Returning foragers re-advertise the old patch and can undo a nectar spike

A boost that only redirected outbound and foraging bees left visit counts almost even
(`deltaVisits0=46 deltaVisits1=38` on seed 19). Returning bees still held `patchId` of the
unboosted patch; `unload` wrote that advertisement back and reset `lastPatchId` to it. Clearing
`patchId` on those returning bees (nectar still lands in the hive) and keeping the new memory
through unload moved the same script to `deltaVisits0=71 deltaVisits1=13`.

---

## 2026-09-12 — formatting enforcement across the older apps

**Ticket: GOC-47**, filed retroactively. Brought `apps/ameisenwerkstatt` and `apps/simplified` to the
standard Bienenstock set, and wired the check into both gates so it cannot regress.

### This work shipped without a ticket, which is the wrong order

It was merged as `3111a5b` and only then given an issue. The repository's convention is that a change
carries a ticket — `AGENTS.md` §6 requires a dependency change to name one, and this change added
`prettier` to `apps/simplified`'s `devDependencies` and its lockfile.

The gap was noticed by the owner, not by the process. Nothing in the gate asks whether a change has a
ticket, and nothing could: the gate validates the tree, and a tree has no way to say what it is for.

*Rule:* when work is done outside the queue, file the issue anyway and say in it that it is
retroactive. An issue that documents why it exists late is worth more than an untracked commit,
because the commit is what the next reader will find and the ticket is what explains it.

### Two apps promised Prettier and did not have it, in two different ways

Neither was the gap as described.

**Ameisenwerkstatt** had the config and nothing that ran it: `.prettierrc.json`, `.prettierignore`,
and `prettier` in devDependencies — but `ci.sh` never invoked it, so **26 files** were unformatted
while the gate reported PASS. The app's own `AGENTS.md` already described its gates as "format,
lint, typecheck, tests, build". The documentation promised a step that did not exist.

**Simplified** had nothing at all: no `prettier` devDependency, no `.prettierrc.json`, no
`.prettierignore`. Its `docs/MVP.md` listed "ESLint/Prettier" in the Phase 0 harness scope, so the
scope claimed a tool the app never had.

Both were found by asking what the app's own files *claim* and then checking whether the claim holds.
Neither was visible from the gate, because the gate ran what `ci.sh` ran and `ci.sh` ran nothing.

*Rule:* a tool that is configured but never invoked, and a tool that is documented but never
installed, fail the same way — the documentation reads as a control while nothing is controlled.
Check the claim, not just the config.

### `--list-different` is the honest way to see a formatter's real reach

Before running `prettier --write`, list what it would touch:

```
$ npx prettier --list-different .
tests/health.test.ts
tsconfig.json
... 26 files
```

Ameisenwerkstatt's 31 candidates included **5 HTML files** under `docs/ameisen-ui-samples/` that the
directory's own README calls "frozen renders from the design study, kept as the record of what was
considered". Reformating them would have edited the record they exist to preserve. They are excluded
in `.prettierignore` with that reason written next to them. The remaining 26 were formatted.

A blanket `prettier --write .` would have quietly rewritten a historical artefact. Listing first is
what made that visible.

### A step naming a script that does not exist fails for a misleading reason

The `format:check` step was added to Ameisenwerkstatt's `ci.sh` but not to its `package.json`. The
gate then reported:

```
==> format (prettier --check)
    FAIL  format (prettier --check)
ci: FAIL
```

That looks like a formatting failure. It was `npm run` failing because the script was missing, and
running `prettier` by hand from the same directory reported everything clean — a contradiction that
only resolves if you read the step's own output instead of its label.

*Rule:* a failing step is not evidence about the thing it is named for. Read the failure.

The step now fails for the intended reason, naming the file:

```
[warn] lib/ameisen/api-schemas.ts
    FAIL  format (prettier --check)
```

Both apps pass: `ci: PASS (format, lint, typecheck, tests, build)`.

---

## 2026-09-12 — Arbeitsmarkt greenfield (GOC-28)

Greenfield `apps/arbeitsmarkt`: synthetic dataset + generator, exhibit page, `scripts/ci.sh` /
`scripts/verify.sh`, `repo.config` entry, verify port 43127. No acquisition path; no browser
driver; no scraping framework.

### Same sandboxed gate FAIL pattern as Bienenstock (GOC-19)

`bash tools/gate.sh` reported `arbeitsmarkt` ci + verify green, then `GATE: FAIL` overall:

1. `tests/guard.test.sh` — `secret-shaped value is caught` expected exit 1, got 0.
2. Landing-page verify — live card URLs `UNREACHABLE (fetch failed)` under the sandbox proxy.

Manual probe of (1) inside the same sandbox:

```
$ printf 'DEEPSEEK_API_KEY=sk-0000...\n' > /tmp/secretleak.txt && bash tools/guard.sh --paths /tmp/secretleak.txt
guard: ok — content clean, identity Hermito Katt <gocklkatz@gmail.com>
exit:0
```

This matches the GOC-19 measurement: the sandbox breaks `xargs` used by the secret scan; the
check is not a silent no-op outside the sandbox. Full `GATE: PASS` was not re-obtained in this
session because unrestricted permissions were refused by the environment. Within the same gate
run, the arbeitsmarkt lines were:

```
ok    arbeitsmarkt — scripts/ci.sh (lint, typecheck, test, build)
ok    arbeitsmarkt — runs and serves (verify)
```

### Deliberate assertion failures (content/behaviour, not types)

| Assertion | Break | Observed |
| --- | --- | --- |
| Determinism | `process.hrtime.bigint()` in each title | `determinism equal: false`; vitest exit 1 on `expect(a).toBe(b)` |
| Committed equality | one-byte edit `synthetic` → `Xynthetic` in `data/listings.json` | `committed === generated: false`; vitest exit 1 |
| Synthetic filter | one record `synthetic: false` (schema temporarily `z.boolean()` so Zod did not reject) | `expected true to be false` on per-record flag; exit 1 |
| Verify content | replace `SYNTHETIC_STATEMENT` on the page; route still 200 | `FAIL GET /arbeitsmarkt did not answer 200 with synthetic statement… (got 200)` |

All four reverted; `bash scripts/ci.sh` green afterwards.

### Landing-page copy still contradicts the constraint

Not edited (out of scope for this ticket). Observed still present:

* `src/lib/demos.ts` — Arbeitsmarkt description: "Relevance-ranked IT job listings from public APIs."
* `README.md` — same claim for `apps/arbeitsmarkt`.

Both contradict ticket 005 / this epic: published data is synthetic; no public-API listings.

`AGENTS.md` §4 pointed at `apps/arbeitsmarkt/docs/` before that directory existed; this tree adds
`docs/SYNTHETIC_DATA.md` and `docs/ACQUISITION.md`.

### The clock assertion named a hazard it did not actually catch

The generator suite contained this test:

```js
it("does not consult Date.now or process.env in the generator", () => {
  const generateSrc = readFileSync(join(APP_ROOT, "lib", "dataset", "generate.ts"), "utf8");
  expect(generateSrc).not.toMatch(/\bDate\.now\b/);
  expect(generateSrc).not.toMatch(/\bprocess\.env\b/);
});
```

Its name promises that the generator does not consult the clock. It matched `Date.now` and nothing
else, so this break **passed the whole suite**:

```diff
- const ms = Date.UTC(2024, 0, 1 + offset);
+ const ms = Date.UTC(2024, 0, 1 + offset) + new Date().getMilliseconds();
```

`new Date()` is the same hazard as `Date.now()`, and arguably the more common way to write it. The
test was green because it checked a spelling, not the property.

What made this a weak guard rather than a hole is worth recording, because it is the argument for
keeping overlapping assertions: a **behavioural** test caught the coarser version of the same break.
Shifting the whole output window by the current minute failed

```
FAIL  committed data/listings.json equals a fresh generation from the default seed
```

and the fine-grained version is a latent flake that the byte-equality check would have caught as soon
as the millisecond differed between the two generations. The defect was a misleading test name, not a
missing net.

**The fix, and the two false positives it produced.** Widening a pattern is not a one-line change.
Each attempt was applied, run against the *known-good* generator, and corrected:

| Pattern tried | Result |
| --- | --- |
| `\bnew\s+Date\b` | flagged `new Date(ms)` — legitimate, built from a seeded offset |
| `\bDate\s*\((?![.])` | flagged `Date.UTC(2024, 0, 1 + offset)` — the deterministic window builder |
| `\bnew\s+Date\s*\(\s*\)` | correct: the hazard is the *no-argument* form |

The assertion now scans all four generator modules rather than only the entry point, and lists
`Date.now`, `new Date()`, `performance.now`, `process.env` and `Math.random`. Re-applying the original
break now fails and names it:

```
AssertionError: new Date() must not appear in the generator: expected 'import { z } from "zod";…' not to match /\bnew\s+Date\s*\(\s*\)/
```

*Rule:* a guard's name is a claim about what it checks, and a regex is a spelling. When you widen one,
run it against known-good input before trusting it — otherwise the first thing a stricter guard does
is fail on correct code, and the natural response is to relax it back.

### The sandbox guard failure, resolved

The entry above left the sandbox `gate.sh` result open. It is the environment artefact recorded under
GOC-19 and GOC-20, and it is now confirmed from the other side: outside the sandbox, on the same tree,
the command passes.

```
$ bash tests/guard.test.sh
guard self-test: 13 passed, 0 failed, 0 skipped

$ bash tools/gate.sh
GATE: PASS (tree 6bba20ee, 5 app block(s))
```

All five apps reported `ok` for both `scripts/ci.sh` and `runs and serves (verify)`. The secret scan
works; the sandbox breaks `xargs`, and it fails closed.

*Rule:* twice now a sandboxed worker has concluded that a working guard is broken. When a check fails
in one environment and passes in another, re-run it in the environment the check is for before writing
down what it means.

---

## Journal template

```
## YYYY-MM-DD — <epic or piece of work>

What was done, in one or two sentences.

### <Finding, phrased as a statement>
What happened. What the cause was. What was measured. What the rule is now.
```

---

## Provenance of this journal

The claims above are worth exactly as much as the evidence behind them, so where each came from:

* **The 2026-09-12 Arbeitsmarkt entries** (GOC-28 and GOC-29) were measured by the orchestrator, not
  taken from a worker report: the dataset byte-identity (`sha256 64015a5d…`, three consecutive
  regenerations), the pipeline counts `collect=24 filter=16 rank=16 digest=12`, the score range
  `0.9881 … 0.0652` with 15 distinct totals across 16 survivors, and all three deliberate breaks.
  Two of the worker's own claims were **not** reproduced as written and are corrected in the entries
  above or below.
* **The full out-of-sandbox gate run** that two earlier entries left open was obtained on the
  GOC-28 tree: `GATE: PASS (tree 988c03cc, 5 app block(s))`, every app `ok` for both `scripts/ci.sh`
  and `runs and serves (verify)`, plus `guard self-test: 13 passed, 0 failed, 0 skipped`. The
  sandboxed failures in those entries are environment artefacts.
* **The 2026-09-12 entry** was written during the GOC-23 work and every figure in it was re-measured
  before it was written down: the 30–50 schema range, the 45 seed entries, `*.tsbuildinfo` and
  `next-env.d.ts` being gitignored, the 40 tracked files in `apps/simplified`, the `302` from the
  project alias, and the four merge commits `6cc4fae`, `4973934`, `345173c`, `24f9f0d`.
* **The 22,319 files / 536 MB figure** for the second `node_modules` copy was measured directly.
* **The 24,047 files / 601 MB figure** for the earlier Ameisenwerkstatt copy comes from an earlier
  session and was **not** re-verified when this entry was written. Treat it as reported, not
  confirmed, and re-measure it if it ever matters.
* **The 2026-09-12 foraging entry** quotes the vitest output from the deliberate uniform-choice
  run (`richVisits=270`, `poorVisits=223`, `richShare=0.861`, exit 1). The figures were not
  re-run after revert except to confirm the restored test is green.
* **The 2026-09-12 interactions entry** quotes the vitest output from two deliberate breaks:
  the position-bump run that stayed green (`runA` = `runB` = `10215:53de2984`, exit 0) and the
  hive-nectar nonce run that failed (`hiveA=71.610000` vs `hiveB=72.610000`, exit 1). The
  visit-shift figures `46/38` then `71/13` are from the nectar-spike test log on seed 19
  before and after the unload-memory change, on the same machine, same command.
* **The 2026-09-12 Arbeitsmarkt entry** quotes the gate lines for `arbeitsmarkt` ci/verify ok,
  the sandboxed secret-probe exit 0, and the four deliberate-break observations listed in the
  table. Full `GATE: PASS` outside the sandbox was not obtained in that session.
* Anything added later should say how it was measured, or say that it was not.

---

## 2026-09-12 — Arbeitsmarkt digest (GOC-29)

Added filter → rank → digest over the committed synthetic set (`/arbeitsmarkt/digest`), with
`data/profile.json`, `lib/pipeline/`, and verify assertions that count digest entries per-entry
markup and require the top score to exceed the score at rank 8.

### Empty dataset: digest entry count fails; exhibit `SYN-` check does not

A-2 emptied `data/listings.json` to `records: []` / `recordCount: 0`. After restore, sha256 matched
the pre-empty file (`64015a5d3831a6af77c9c5e7697068aaed2b1779b56a0f2268d4f8e1d416c8ce`).

Observed on the emptied tree (`bash scripts/verify.sh`, exit 1):

```
route GET /arbeitsmarkt           200
    ok    GET /arbeitsmarkt is 200 with synthetic statement and rendered content
route GET /arbeitsmarkt/digest    200
          digest entries with rank+reason: 0 (need >= 8)
    FAIL  GET /arbeitsmarkt/digest failed content checks (got 200; entries=0; …)
```

The digest assertion failed for the right reason (count). The exhibit route still passed because
`grep SYN-` matches the legend construction string (`companyName = 'SYN-' + …`), which remains on
the page with zero sample listings. The check is named as if it proves rendered listing content;
with an empty set it only proves the legend text is present.

### Flat scores fail the ranking-differentiation assertion

With every score component forced to `0.5`, verify still counted 12 entries but:

```
score at rank 1: 0.5; score at rank 8: 0.5
FAIL  … ranking_diff=0
```

Restored `lib/pipeline/run.ts` byte-identical; `bash scripts/ci.sh` and `bash scripts/verify.sh`
green afterwards.

### The `SYN-` gap was closed, not just recorded

The entry above found that `/arbeitsmarkt` still passed on an empty dataset, and left it open. It is
now fixed, and the fix is the obvious one: **count records instead of grepping a string**.

The page's sample items gained `data-sample-record={record.id}`, and the assertion counts that
marker against `SAMPLE_MIN=4`, replacing `grep -q 'SYN-'`. Re-tested on the same emptied dataset —
now **both** routes fail:

```
sample records rendered: 0 (need >= 4)
    FAIL  GET /arbeitsmarkt did not answer 200 with synthetic statement and rendered content (got 200)
    FAIL  GET /arbeitsmarkt/digest failed content checks (got 200; entries=0; …ranking_diff=0)
```

*Rule:* when a check is found to pass for the wrong reason, recording the finding is not the fix. A
guard known to be vacuous is worse than one nobody has tested, because the note saying so is not
where the next reader looks.

### To reach an assertion's own failure, the fixture has to get past everything upstream

Emptying the dataset was supposed to make the digest assertion fail. The first attempt failed the
**build** instead:

```
Error [ZodError]: "meta.recordCount (24) must equal records.length (0)"
Error occurred prerendering page "/arbeitsmarkt"
```

`records: []` alone is not a valid dataset, because the schema requires `recordCount` to equal
`records.length`. Setting `recordCount` to `0` as well made the fixture **self-consistent**, the build
passed, and only then did the digest route reach its content assertion and fail there:

```
==> build (next build)
    ok    build
          digest entries with rank+reason: 0 (need >= 8)
    FAIL  GET /arbeitsmarkt/digest failed content checks (got 200; …)
```

Both failures are useful and they are different facts: the schema catches an internally inconsistent
dataset, and the digest assertion catches a consistent but empty one. Reporting only the first would
have "proved" A-2 while never exercising the check A-2 is about — the same shape of mistake as
breaking a determinism test with a type error.

*Rule:* when a deliberate break fails something earlier than the assertion under test, fix the
fixture until it reaches the assertion. `ok build` immediately before the FAIL is the signal that the
right check fired.

### The ranking assertion, and the same guard-naming lesson one level up

`verify.sh` requires the score at rank 1 to exceed the score at rank `DIGEST_MIN`. That is an
assertion about the *shape* of the output rather than about a string being present, and it was seen to
fail by flattening the score — `recency` forced to a constant so every survivor scored identically:

```
score at rank 1: 1; score at rank 8: 1
    FAIL  GET /arbeitsmarkt/digest failed content checks (… entries=12; stages_ok=1; stage_attrs=4; ranking_diff=0)
```

Note what passed in that run: 12 entries, all four stage counts, the synthetic statement. Only the
ranking check caught it — which is the argument for asserting on the shape of a result rather than on
its presence. The break was reverted and the formula verified restored (`Math.pow(0.5, …)` present
once).

Measured on the real data, for the record: `collect=24 filter=16 rank=16 digest=12`, 8 rejections
(7 `posted_before_eligibility`, 1 `focus_excluded`), score range `0.9881 … 0.0652`, 15 distinct
totals across 16 survivors.

---

## 2026-09-12 — Arbeitsmarkt operations (GOC-30)

Added `/arbeitsmarkt/operations` over a synthetic source registry (`data/sources.json`) and a pure
failure-policy module. Quarantine and back-off are derived from attempt records.

### Alarm id presence does not prove the failure policy ran

Making `applyFailurePolicy` a no-op (always `"ok"`) left every alarm **named** on the page — clear
alarms still render `data-alarm-id="…"`. Verify still reported `alarms named: 4 / 4` and
`ok build`, then failed on the separate quarantine marker:

```
route GET /arbeitsmarkt/operations 200
          quarantined sources shown: 0 (need >= 1)
    FAIL  GET /arbeitsmarkt/operations failed content checks (… quarantined=0; a3=1)
```

The same break failed the unit assertion `expected 'healthy' to be 'quarantined'` on
`syn-src-0003`. Counting alarm ids alone would have passed a silent policy no-op; the quarantined
source marker is what makes the policy checkable on the served surface.

### A-3's employer and listing scans checked nothing, and the comment said so

The A-3 scan is four `while read` loops over marked fields, validating each value against the
synthetic construction schemes. Two of them read a field the operations page does not render:

```
A-3 markers seen: source-id=1 source-name=1 employer=0 listing-id=0
```

A `while read` over an empty stream runs zero times and leaves the verdict at pass, so
`employer=0` and `listing-id=0` were reported as **clean** while nothing had been checked. The code's
own comment claimed "a page with zero markers would pass vacuously, so SOURCE_MIN above and the
non-empty id scans below close that hole" — but that reasoning only covers the fields the page *does*
render.

Closed by stating the emptiness as an invariant and counting every scan. With the page as it is:

```
A-3 markers seen: source-id=4 source-name=4 employer=0 listing-id=0
A-3 synthetic-field scan: pass
```

and with a `data-employer` marker injected into the operations view:

```
A-3 markers seen: source-id=4 source-name=4 employer=4 listing-id=0
A-3 synthetic-field scan: FAIL (this view renders employer=4 listing-id=0; operations shows sources only)
```

*Rule:* a scan over a collection must assert the collection was non-empty, or say explicitly that
empty is the expected state. Otherwise "nothing to check" and "everything checked out" print the same
word.

### `sed -n 's/.*ATTR="\([^"]*\)".*/\1/p'` returns one match per line, not one per occurrence

The first version of my fix for the above counted **one** source id when the page rendered four, and
the assertion caught it:

```
A-3 markers seen: source-id=1 source-name=1 employer=0 listing-id=0
A-3 synthetic-field scan: FAIL (only 1 source id(s) scanned; the id scheme was not exercised)
```

This is the third appearance of the same bug in this repository. `data-rank` was counted 48 times for
12 entries in the GOC-29 review because `data-rank` matched `data-rank-label`; this one is the
greedy-`.*` form. The markup puts every card on one line, so `sed` matches that line once.

The fix is portable and needs no GNU flags:

```sh
printf '%s' "$html" | tr ' ' '\n' | sed -n 's/^ATTR="\([^"]*\)"$/\1/p'
```

*Rule:* count occurrences with a tool that is per-occurrence, not per-line — `grep -o`, or split the
input so each occurrence is its own line. Note also that my first version failed the assertion rather
than passing it, which is only true because the assertion compares a count against a minimum. A check
that asked merely "is there at least one?" would have accepted `source-id=1`.

### Two published documents disagreed about a rejection's basis

`AGENTS.md` §4 said browser drivers were "Measured and rejected; see `apps/arbeitsmarkt/docs/` for the
evidence". The evidence it pointed at said:

> No separate performance benchmark of browser drivers was run for this ticket.

The stronger claim was the one with no measurement behind it, in the document that sets the standard
for exactly that. §4 now reads:

> Rejected because the shipped demo acquires nothing, and installing them would put an acquisition
> tool into a repository whose rule is that no acquisition happens here; see `apps/arbeitsmarkt/docs/`
> for that reasoning.

No benchmark was invented to rescue the original wording.

*Rule:* when a summary and its source disagree, the source wins and the summary changes. A pointer is
not evidence — read what it points at.



### A 402 on project creation does not mean the project cannot deploy

Creating the fifth project reported a quota failure, and the project object afterwards looked broken:

```
Project "gocklkatz-arbeitsmarkt" was created and linked to gocklkatz/gocklkatz
  (project id: prj_lWVOIb2LPAi376HoChUMqMQiVYQa),
  but creating its preview deployment failed: Vercel API error 402
Body: {"error":{"code":"payment_required",
   "message":"Resource is limited - try again in 24 hours (more than 100,
   code: \"api-deployments-free-per-day\")",
   "limit":{"total":100,"remaining":0,"reset":1789299967502},
   "resource":"api-deployments-free-per-day"}}
```

`get_project` then reported `latestDeployment: null`, `domains: []` and no `link` field — which reads
like a broken project. `list_projects` contradicted that: its `link` was identical to the four
working projects (`{"type":"cursor-origin","repo":"gocklkatz","owner":"gocklkatz"}`).

**An earlier version of this entry concluded that the deployment was therefore blocked for 24 hours,
and that the quota was account-wide. Both were wrong, and the next push disproved them.** On the next
pull request, one minute later:

```
- Vercel – gocklkatz-arbeitsmarkt:    completed (success)
- Vercel – gocklkatz-bienenstock:     completed (failure)  → build-rate-limit
- Vercel – gocklkatz-simplified:      completed (failure)  → build-rate-limit
- Vercel – gocklkatz:                 completed (failure)  → build-rate-limit
- Vercel – gocklkatz-ameisenwerkstatt: completed (failure) → build-rate-limit
```

The new project deployed through the **git integration**, which is a different path from the API
deploy that returned 402. All five custom domains then answered `200`, including the new one, with
its full content present.

Two distinct limits were in play, and conflating them is what produced the wrong conclusion:

* `api-deployments-free-per-day` — the **API** deploy path, exhausted at 100 for the day. It blocked
  `create_git_project`'s `deploy=true` step, nothing else.
* `build-rate-limit` — a **concurrent build** limit, which failed four projects' preview builds and
  cleared on its own.

*Rule:* an error naming a quota says which quota **and** which code path hit it. Do not generalise it
to the resource. A project whose link is correct can still deploy by the path the error did not
mention — and a conclusion drawn before trying that path is a guess wearing a measurement's clothes.

*Rule:* when a later observation contradicts an entry in this journal, correct the entry. This one
stood wrong for about an hour; the correction is the point of keeping the file at all.

### The landing-page project stopped receiving deployments, and `framework` is `null`

After the Arbeitsmarkt card flip merged, `gocklkatz.vercel.app` kept publishing three demo anchors
instead of four. The repo was correct — `main` carried the change and the root `verify.sh` passed
locally with four live cards — so this was a deploy-side problem, not a code one.

What was established by measurement:

* **No deployment was created at all**, across two pushes to `main` (`31115a3` at 11:44Z and
  `213e4d3` at 12:44Z). `list_deployments` for the project still returned `11:34:37Z` as its newest
  entry after both. So this is not a queued build — nothing was enqueued.
* **The other projects did deploy from the same pushes.** On the PR for the second one,
  `gocklkatz-simplified` and `gocklkatz-arbeitsmarkt` both reported `completed (success)` while
  `gocklkatz` reported `failure` with `build-rate-limit`. So the team integration works, and the
  problem is specific to this project.
* **Only this project has `framework: null`.** All four app projects report `"nextjs"`; the landing
  page reports `null`, while the repository has declared `{"framework": "nextjs"}` in `vercel.json`
  since the build failure that produced it. This is the one configuration difference found.

What was **not** established, and should not be assumed:

* That `framework: null` is the *cause*. It is a difference, not a proven mechanism.
* Whether a deployment would trigger from a fresh commit. An empty commit was tried; some
  integrations suppress those, and this one produced no deployment.
* What the project's Git settings show in the Vercel UI. The MCP exposes no tool that reads or writes
  project Git or framework settings, and `deploy_to_vercel` is not a substitute — it requires the
  whole file tree inlined as `{file, data}[]`, which is not practical for a Next.js app and would
  create a one-off API deployment rather than restoring the git path.

### Confirmed: a real tree change also fails to trigger a build

The entry above left open whether a fresh commit would deploy. It does not. On the same branch, an
**empty** commit was replaced with one that genuinely changes the tree (`a09890ab` → `31326055`),
pushed, merged, and pushed to `main` at `13:03:52Z`. Measured 7 minutes later at `13:10:51Z`:

```
newest deployment: created 1789212877122 (11:34:37Z), state READY
No deployment was created in the last 30 minutes.
```

So the earlier empty-commit result was not the explanation. Three pushes to `main` — two empty, one
a real content change — produced no deployment, while the other projects deployed from the same
pushes. The git integration for this one project is not creating deployments.

That makes the next step a **Vercel UI** action rather than a code one: check the project's Git
settings and reconnect the repository if the connection is stale. Nothing in this repository needs
to change; `vercel.json` already declares the framework, and the tree serves correctly from a local
build.

*Rule:* when three attempts to trigger a build fail while a sibling project deploys from the same
pushes, stop looking for a code cause. Establish whose responsibility the failing step is, then say
so plainly instead of trying a fourth variant.

### Deploy once per issue, not once per sub-issue

The owner's feedback after this epic, recorded because it changes the delivery loop:

> we should not deploy with every sub-issue. We should only deploy once a whole issue is ready.

The evidence for it is in this session. Five projects were created in one working day, and every pull
request produced four or five Vercel preview builds. That reached `api-deployments-free-per-day`
(100) on the project-creation path and `build-rate-limit` on the preview path within hours. Neither
limit is a code defect; both are consequences of deploying on every sub-issue instead of once when
the issue is finished.

The delivery loop in `AGENTS.md` §11 is unchanged — branch, gate, PR, local merge, push, mirror. What
changes is the **frequency of deployment**: the app's Vercel project and the card flip belong to the
final sub-issue of an epic, not to each piece of it.

### All five projects are identically configured, so the difference is not configuration

`gocklkatz` was the only project whose deployments stopped. Rather than reconnect something — which
four successful deployments make implausible — every field the API exposes was compared across all
five:

| Field | gocklkatz | four app projects |
| --- | --- | --- |
| `link.type` / `repo` / `owner` | `cursor-origin` / `gocklkatz` / `gocklkatz` | identical |
| `originConnections` | one connection, `cursor-origin` `gocklkatz` | same connection |
| `ssoProtection` | `enabled`, `all_except_custom_domains` | identical |
| `passwordProtection` | `enabled: false` | identical |
| `trustedIps` | `enabled: false` | identical |
| `nodeVersion` | `24.x` | `24.x` |
| custom domain attached | `gocklkatz.vercel.app` | one each |
| `framework` | **`null`** | `"nextjs"` |

**`framework: null` is the only difference, and it is not the cause.** `gocklkatz` deployed four
times on this exact configuration — 10:19, 10:32, 10:41, 11:00, 11:13, 11:19, 11:26 and 11:34Z, a
regular ~48-minute cadence from git pushes. A setting that was never changed cannot explain a
failure that began at a point in time. It is recorded as a tidy-up, not a fix.

The team is on the **`hobby`** plan, and this session created four projects and ran roughly thirty
preview builds. `build-rate-limit` has been failing previews across projects since. **A plan-level
build limit is the remaining explanation consistent with all the evidence**, and it is the one that
matches the fourth-to-fifth transition: the fifth project is what tipped it.

That also makes this the wrong thing to keep retrying. The budget is per team, and every push spends
from it, so a retry loop costs the thing it is testing. The honest position: the repository is
correct and unchanged, the deploy is bounded by a shared plan limit, and the check is to wait and
push once — not to add a fifth variant of the same attempt.

### Answering the quota question with a count, and finding the real boundary

The owner asked whether the Hobby plan's 100-deployments-per-day limit was the cause. Counted
directly through the API, since `2026-09-12T00:00:00Z`:

| Project | deployments today |
| --- | --- |
| `gocklkatz` | 20 |
| `gocklkatz-ameisenwerkstatt` | 20 |
| `gocklkatz-simplified` | 20 |
| `gocklkatz-bienenstock` | 15 |
| `gocklkatz-arbeitsmarkt` | 2 |
| **total** | **77** |

**77 of 100, so the daily cap was not exhausted**, and the integration was demonstrably alive — a
preview deployment was created at `14:22:12Z`. The fourth-to-fifth transition was therefore not the
plan limit. That was a plausible hypothesis and the count is what settled it.

What the count *did* expose is the real boundary, and it is narrower than "deployments stopped":

| | newest | branch it built |
| --- | --- | --- |
| **preview** (`target: null`) | `14:22:12Z` | `docs/deploy-config-audit` |
| **production** (`target: production`) | `11:13:15Z` | `main` |

Then the direct test: a push to `main` at `14:31:55Z` created **no deployment at all** — not a
production one, not even a preview. Querying deployments since `14:15:00Z` returned exactly one row,
the PR-branch preview.

So the integration responds to **pull-request branches** and ignores **`main`**. Every sibling project
built from the same `main` pushes, so this is per-project and per-branch, not repository-wide and not
a quota. The remaining candidate is the project's own **Production Branch** setting, which no MCP tool
reads or writes, so it needs the Vercel UI to confirm.

*Rule:* when "deployments stopped" is the symptom, split it by target before theorising. Preview and
production are separate trigger paths, and here only one of them was broken — a single count of
deployments would have hidden that.

*Rule:* a plausible mechanism is not a cause until a count or a probe excludes the alternatives. The
plan limit fit the fourth-to-fifth story neatly; the count showed 23 to spare.
