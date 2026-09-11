# Worker brief — ticket 001

You are the **implementer**. A separate orchestrator owns the requirement, reviews your tree, and
authors the commit. Read these first:

1. `docs/tickets/001-landing-page.md` — **the frozen work order.** Requirement and acceptance
   criteria. This is the landing page for the whole portfolio.
2. `AGENTS.md` — the standing contract for this repository.

## Hard rules

* **Do not commit. Do not push. Do not create a branch.** Leave your work in the working tree.
* **Do not edit the ticket.** It is frozen. If the requirement is wrong, stop and say so.
* **Do not add a browser driver.** Plain `curl` or Node's `fetch` is enough for `verify.sh`, and
  adding a driver is a policy decision this ticket does not make.
* **This repository is public.** No secrets, no personal identifiers, no absolute local paths.
  `tools/guard.sh` blocks the commit if you break this.
* **Do not write the content patterns from `tools/pii-patterns.txt` into any file**, including
  comments and tests. Feed that file to a search rather than restating it.

## Part 2 — what to implement

Everything in the ticket's **Requirement** section, verified by every command in its
**Acceptance criteria**.

This is the first application in the repository, so it establishes the pattern the four demos will
follow. Get the shape right:

* **`scripts/ci.sh`** — lint, typecheck, tests, build. It must resolve its own directory, like the
  other gates here, so `repo.config` can invoke it from the root.
* **`scripts/verify.sh`** — build, start, probe, shut down, exit non-zero on any failure.
* **A distinct port.** The Ameisenwerkstatt demo uses 43123. Use **43124** and fail cleanly if it
  is already in use. Wait for the port to accept connections rather than assuming the server is up.

**The link rule in requirement 4 is the part that matters.** A card whose status is `live` must
link to a URL that resolves; a card whose status is `in-development` must render **no anchor at
all**. `scripts/verify.sh` must assert both directions. All four cards are `in-development` today,
so the everyday run exercises the second direction — which means you must also satisfy acceptance
criterion A-5, where a card is temporarily set to `live` with an unresolvable URL and the verify
step must fail. A link check that has never been seen to fail is not a link check.

**`repo.config`** — register the app as a root-path application:

```yaml
apps:
  - name: gocklkatz
    path: .
    enabled: true
    verify_cmd: bash scripts/verify.sh
```

If `tools/gate.sh` cannot handle `path: .`, fix the gate to support it rather than special-casing
the app elsewhere.

**Dependencies** — `docs/DEPENDENCY_ALLOWLIST.md` at the root governs. It already lists `next`,
`react`, `react-dom`, `zod`, `typescript`, `eslint`, `eslint-config-next`,
`eslint-config-prettier`, `prettier`, `vitest`, `vite` and the `@types/*` packages, so you should
not need to add anything. Run `node tools/check-deps.mjs` and keep it green; if you genuinely need
a new package, add it to the allowlist in the same change with a reason.

## Part 3 — how to report

The tree is the deliverable; the report is a bonus. Report:

1. **What you built** — files and one line each.
2. **Acceptance evidence** — for every criterion A-1 to A-6, the exact command and its **raw
   output**. Not a summary, not "passes". For A-5 you must temporarily set a card to `live` with an
   unresolvable URL, show `verify.sh` failing and naming the card, then revert.
3. **What you did NOT verify** — be specific.
4. **Decisions the ticket did not cover** — anything you had to choose, and why.

Do not claim success without pasted command output. If a criterion cannot be met as written, stop
and say so rather than working around it.
