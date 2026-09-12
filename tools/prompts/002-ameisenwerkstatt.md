# Worker brief — GOC-14

You are the **implementer**. A separate orchestrator owns the requirement, reviews your tree, and
authors the commit. Read these first:

1. `docs/tickets/002-ameisenwerkstatt.md` — the frozen work order (Linear `GOC-6`). Work the parts
   that are implementable; one part is explicitly a Human step.
2. `AGENTS.md` — the standing contract, especially §1 (identity), §2 (public bar), §7 (verify by
   running) and §11 (merging).
3. `docs/tickets/001-landing-page.md` — the landing page is the app already in this repository, so
   it is the pattern to follow for `scripts/ci.sh`, `scripts/verify.sh` and `repo.config`.

This brief is kept as the historical work order for `GOC-14`. The application it describes lives in
`apps/ameisenwerkstatt` in this repository, and the checkout it was originally read from is not part
of the workflow any more; its identity is recorded in the Linear issue, not here.

The rule it recorded still governs any future import of an application: **import from a tracked file
list, never copy a working directory.** An untracked working directory carries `node_modules/`,
`.next/`, `.idea/` and other ignored artefacts — in this case 24,019 files, most of them noise, and a
worker that copied one dragged all of them into the repository.

## Hard rules

* **Do not commit. Do not push. Do not create a branch.** Leave your work in the working tree.
* **Do not edit the ticket.** It is frozen. If the requirement is wrong, stop and say so.
* **Do not write machine-local absolute paths, or the content patterns from
  `tools/pii-patterns.txt`, into any tracked file** — including comments. The guard blocks them.
  Use `$HOME` in prose, or repository-relative paths.
* **Do not add a browser driver.** `curl` or Node's `fetch` is enough.
* **Do not touch the landing page** beyond adding this app to `repo.config`. It is finished and
  verified.

## What to do

**1. Place the application at `apps/ameisenwerkstatt/`.** Preserve behaviour exactly. These
surfaces must keep working unchanged: `/`, `/ameisen`, `GET /api/health`,
`GET /api/ameisen/snapshot`, and the mutate-gated `POST` routes for params, step and tools. The app
requires no restructuring — it is already a standalone directory.

**2. Bring the documents to the public bar.** The application's prose was written for private use.
This repository is public and authored by the company. There is no personal name anywhere in it,
ever. Apply this triage, and record your decisions:

| Treatment | Documents |
| --- | --- |
| **Keep and rewrite** — the product, the design decisions, the demo | `docs/AMEISENFABRIK.md`, `docs/AMEISENFABRIK-UI.md`, `docs/DEMO.md`, `docs/eval/`, `prompts/aco/`, `docs/ameisen-ui-samples/` |
| **Retarget at the root** — operational material that the root files now own | `docs/DEPENDENCY_ALLOWLIST.md`, `docs/DEPLOY.md`, `docs/PR_REVIEW.md`, `docs/BRANCH_PROTECTION.md`, `docs/COMPUTER_USE_GATE.md` |
| **Withhold** — internal process narrative, not part of a demo | `docs/Lean_Factory_Loop.md`, `docs/GENESIS_TICKET_DRAFTING.md`, `docs/TICKETS.md`, `docs/ROADMAP.md`, `docs/DEMO-2.md`, `docs/insights-grokbot-x-factory-patterns-2026-09-08.md` |
| **Your judgement — stop and say so if unsure** | `docs/RED_GATE_INCIDENT.md` |

On the last one: it records an engineering incident and what it taught. That is the kind of material
this portfolio wants. But it may also name people and internal process. **Read it, decide, and write
your reasoning in the report.** If it can be published as an honest account of a real failure with
the names and internal detail removed, keep it; if not, say why and withhold it.

`AGENTS.md` in the app: it describes the old repository's process and contradicts the root file.
Reduce it to app-specific notes that do not contradict `AGENTS.md` at the root, or delete it. State
which you chose.

Delete every reference to the other repository: its name, clone URL, branch protection and issue
tracker. `README.md`, `docs/DEPLOY.md`, `docs/BRANCH_PROTECTION.md` and `AGENTS.md` all carry them.

**3. Add `apps/ameisenwerkstatt/scripts/verify.sh`.** `scripts/ci.sh` proves the app builds and its
tests pass; it does not prove the app runs. The script must:

* build, then start the server, waiting for the port rather than assuming it is up;
* fetch `/`, `/ameisen` and `/api/health`;
* assert each is HTTP 200, that `/api/health` parses as JSON with `"ok": true`, and that the
  `/ameisen` body contains text the page actually renders — a 200 on an error page must not pass;
* fail cleanly if the port is already bound;
* always shut the server down, including on failure, and assert the port was released.

The app binds port **43123**. The landing page holds 43124. No browser driver.

**4. Register the app in `repo.config`** in the same working tree:

```yaml
apps:
  - name: gocklkatz
    path: .
    enabled: true
    verify_cmd: bash scripts/verify.sh
  - name: ameisenwerkstatt
    path: apps/ameisenwerkstatt
    enabled: true
    verify_cmd: bash scripts/verify.sh
```

**5. Run `node tools/check-deps.mjs`.** The root allowlist already carries what the app needs. If
something is genuinely missing, say so — do not edit the allowlist yourself.

**Not your job:** creating the Vercel project and attaching the custom domain. That is a Human step;
say so in the report rather than claiming the demo is live.

## How to report

1. **What you did** — files, and your documentation triage decisions with reasoning, especially for
   `RED_GATE_INCIDENT.md` and the app's `AGENTS.md`.
2. **Acceptance evidence** — for each criterion in the ticket, the exact command and its **raw
   output**. For A-3, deliberately break the `/ameisen` route or stop the server mid-run, show
   verify failing, then revert.
3. **What you did NOT verify** — be specific. The Vercel deployment is one such item.
4. **Decisions the ticket did not cover.**

Do not claim success without pasted command output. If a criterion cannot be met as written, stop
and say so.
