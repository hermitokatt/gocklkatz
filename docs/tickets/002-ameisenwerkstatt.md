# 002 — Add the Ameisenwerkstatt demo

**Linear:** `GOC-6`

## Plain English

Ameisenwerkstatt is the first demo: a working ant-colony optimization simulation with a live 3D
workspace, its own API surface and its own test suite. The application already exists and runs;
what it does not have is a home in this monorepo or a public URL.

This ticket puts it in `apps/ameisenwerkstatt`, brings its documentation up to this repository's
public standard, and gives it a Vercel deployment so the landing page can link to it.

## Requirement

1. **Place the application at `apps/ameisenwerkstatt/`.** It is a Next.js App Router app already
   structured for a standalone directory: its own `package.json`, lockfile, `scripts/ci.sh`,
   `lib/ameisen/`, `tests/`, and route handlers. It should need no restructuring.

2. **Preserve its behaviour.** At minimum these surfaces must keep working exactly as they do now:

   | Surface | Notes |
   | --- | --- |
   | `/` | the app's own landing content |
   | `/ameisen` | the 3D workspace |
   | `GET /api/health` | |
   | `GET /api/ameisen/snapshot` | read-only |
   | `POST /api/ameisen/params`, `/step`, `/tools` | mutate-gated |

   Route paths, response shapes and gating must not change. This ticket relocates the app; it does
   not redesign it.

3. **Copy source files only.** Take tracked files, never a working directory. Build output,
   `node_modules/`, editor directories, `.env` files and caches must not appear in this
   repository. Verify with:
   ```bash
   git status --porcelain
   ```
   and by checking that no ignored artefact path was added.

4. **Professionalise the documentation for public view.** The application's prose was written for
   private use and must be brought to this repository's standard:

   * **No personal names anywhere.** Not as an author, not as a decision-maker, not as a role in a
     process. Attribute design decisions to the project or to a role ("the design review on the
     draft pull request"), never to a person. `tools/guard.sh` enforces this and blocks the commit.
   * **No machine-local paths.** Repository-relative only.
   * **No references to another repository.** Documents that name a different codebase, its clone
     URL, its branch protection, or its Linear project must be retargeted at this repository or
     removed.
   * **No internal process narrative.** Documents that describe an organisation's internal
     working arrangements — named office roles, who merges, who approves, a fictional employer —
     are not part of a demo and must not be published. Withhold them. Product documents that
     describe what was built, why, and how it is demonstrated **are** part of the demo and must
     be kept and rewritten.

   Record in the app's `README.md` which documents were withheld and why, so the omission is
   deliberate and visible rather than silent. If a document you are inclined to withhold actually
   records real engineering, **stop and say so** instead.

5. **Reconcile the app's own control documents with the root ones.** The app carries a
   `docs/DEPENDENCY_ALLOWLIST.md`, `docs/DEPLOY.md` and branch-protection material from when it
   was a standalone repository. The root files now govern. Either delete the app copies or reduce
   them to app-specific notes that do not contradict the root files. State which you chose.

6. **The app's own gate passes in its new location.**
   ```bash
   cd apps/ameisenwerkstatt && bash scripts/ci.sh
   ```
   Its `scripts/ci.sh` already resolves its own directory, so it should pass unchanged. Fix the
   script if it does not, rather than working around it.

7. **`scripts/verify.sh` proves the app runs**, which `ci.sh` cannot:
   * build, then start the server, waiting for the port rather than assuming it is up;
   * fetch `/`, `/ameisen` and `/api/health`;
   * assert each is HTTP 200, that `/api/health` parses as JSON with `"ok": true`, and that the
     `/ameisen` body contains text the page actually renders — a 200 on an error page must not
     pass;
   * always shut the server down, including on failure, and exit non-zero on any failure.

   The app binds port **43123**. Fail cleanly if it is already in use. No browser driver.

8. **Register the app** in `repo.config` in the same commit that lands it:
   ```yaml
   apps:
     - name: ameisenwerkstatt
       path: apps/ameisenwerkstatt
       enabled: true
       verify_cmd: bash scripts/verify.sh
   ```

9. **Vercel project configured** with Root Directory `apps/ameisenwerkstatt` — a Human step in the
   Vercel UI. Done when the demo answers at its production URL.

10. **Flip the landing page card to `live`** once the deployment is verified, in a follow-up
    commit referencing the real URL. Do not set it to `live` before the URL returns 200.

## Acceptance criteria

**A-1 — nothing unprofessional or machine-specific survives.**
```bash
bash tools/guard.sh
```
Exits `0`. Separately, a search of `apps/ameisenwerkstatt/` using the pattern file as input
returns no matches:
```bash
grep -rniE "$(grep -vE '^[[:space:]]*(#|$)' tools/pii-patterns.txt | paste -sd'|' -)" apps/ameisenwerkstatt/
```

**A-2 — the app passes its own gate.**
```bash
cd apps/ameisenwerkstatt && bash scripts/ci.sh
```
Exits `0`.

**A-3 — the served app works.**
```bash
bash tools/gate.sh
```
Exits `0` and reports `ameisenwerkstatt — runs and serves (verify)` rather than a skip.

**A-4 — the repository gate covers it.** `bash tools/gate.sh` lists the app under
`==> applications` with both its `scripts/ci.sh` and its verify reported `ok`.

**A-5 — no build artefacts were added.**
```bash
git ls-files apps/ameisenwerkstatt | grep -E 'node_modules|\.next/|\.env$|\.idea|DS_Store|tsbuildinfo'
```
returns nothing.

**A-6 — Vercel. (Human step.)** `<url>/` and `<url>/api/health` both return `200`, the health
response is `{"ok":true}`, and the URL is recorded in `README.md` and `docs/DEPLOY.md`.

## Out of scope

* Redesigning or extending the simulation.
* The other three demos.
* Changing the app's routes or API shapes.

## Risks / notes

* **Its dependencies must already be allowlisted.** The root list carries `next`, `react`,
  `react-dom`, `zod`, `three` and their `@types/*`. Run `node tools/check-deps.mjs` first; if
  something is missing, add it to the root allowlist in the same commit with a reason.
* **Its `scripts/ci.sh` may carry a stale comment** about CI not yet reporting checks. That is no
  longer true here. Correct it — a public repository should not assert something false about its
  own tooling.
