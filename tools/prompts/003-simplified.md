# Worker brief — GOC-24 (place Simplified in the monorepo)

You are the **implementer**. A separate orchestrator owns the requirement, reviews your tree, and
authors the commit. Read these first:

1. `docs/tickets/004-simplified.md` — the scope (Linear `GOC-8`; the frozen requirement for this
   piece is this brief plus item 1 below).
2. `AGENTS.md` — the standing contract, especially §1 (identity), §2 (public bar) and §7 (verify
   by running).
3. `apps/ameisenwerkstatt/` — the app imported immediately before this one. Follow its shape for
   `scripts/ci.sh`, `scripts/verify.sh` and the `repo.config` entry. Do not copy its code.

This brief is kept as the historical work order for `GOC-24`. The application it describes lives in
`apps/simplified` in this repository, and the checkout it was originally read from is not part of the
workflow any more; its identity is recorded in the Linear issue, not here.

The rule it recorded still governs any future import of an application: **import from a tracked file
list, never copy a working directory.** It was **39 files**; an untracked working directory would
have carried `node_modules/` and the rest of the ignored artefacts with it, which is a mistake this
repository has already lost a run to — a worker copied `node_modules` and dragged in 24,047 files.

## Hard rules

* **Do not commit. Do not push. Do not create a branch.** Leave your work in the working tree.
* **Do not edit any ticket.** If the requirement is wrong, stop and say so.
* **Do not write machine-local absolute paths, or the patterns from `tools/pii-patterns.txt`, into
  any tracked file.** The guard blocks them. Use `$HOME` in prose, or repository-relative paths.
* **This repository is public.** No secrets, no credentials, no personal names.
* **Do not add a browser driver.**
* **Do not touch the landing page or `apps/ameisenwerkstatt`**, beyond adding this app to
  `repo.config`.

## What to do

**1. Place the application at `apps/simplified/` with its behaviour unchanged.** These surfaces
must keep working exactly as they do now:

| Surface | Notes |
| --- | --- |
| `/` | the app's own card |
| `/learn/radicals` | browse |
| `/learn/radicals/[id]` | component detail |
| `/learn/radicals/practice` | recognition practice, progress client-local |
| `GET /api/health` | |
| `GET /api/radicals`, `GET /api/radicals/[id]` | |

**2. Its own gate passes where it now lives.** `scripts/ci.sh` must **stand itself up**: if
`node_modules/.package-lock.json` is missing, run `npm ci` first. The predecessor scripts in these
apps assumed dependencies were present, which is true in a working checkout and false in a fresh
clone, and that is what failed the repository gate for the previous app.

If the app has a `next.config.ts`, check whether it pins Next's workspace root. The app now sits in
a monorepo that also has a root lockfile, so Next can infer the repository root instead of the app
root — which broke `next start` for the previous app. Pin it to the app directory if it is not
already pinned.

**3. Add `apps/simplified/scripts/verify.sh`.** It must prove the app *runs*, which `ci.sh` cannot:

* build, then start the server, waiting for the port rather than assuming it is up;
* fetch `/`, `/learn/radicals`, `/learn/radicals/practice` and `/api/health`;
* assert each is HTTP 200, that `/api/health` parses as JSON with `"ok": true`, and that
  `/learn/radicals` renders **component content rather than an empty shell** — assert on a string
  the page actually renders, so a 200 on an error page cannot pass;
* fail cleanly if the port is already bound;
* always shut the server down, including on failure, and assert the port was released.

**Ports already claimed: 43123 (Ameisenwerkstatt) and 43124 (landing page).** Pick a third and
record it in `docs/DEPLOY.md`'s verify-port table, the way the previous app did.

**4. Register the app in `repo.config`** with `enabled: true` and
`verify_cmd: bash scripts/verify.sh`. Read the existing entries and match their shape exactly — a
previous edit produced a duplicated block that the gate then reported twice.

**5. Run `node tools/check-deps.mjs`.** The root allowlist should already cover this app. If
something is genuinely missing, **say so** rather than editing the allowlist.

## What NOT to do in this piece

**Documentation triage and data provenance are separate pieces of this epic.** Do not attempt them
here. But **report** what you observe, because it feeds them:

* which documents name a person or point at another repository, and
* **what `lib/radicals/seed.ts` and `docs/hanzi_research.md` say about where the character data came
  from.** Do not change the data. Just report what provenance, if any, is recorded, and quote it.

The orchestrator will rule on that separately. A vague "it looks fine" is not useful; a quote is.

**Not your job:** creating the Vercel project or attaching a domain. Say so rather than claiming
the demo is live.

## How to report

1. **What you did** — files, and anything you had to change in the app to make it work here.
2. **Acceptance evidence** — for each item above, the exact command and its **raw output**. Include
   the deliberate-failure proof: break the `/learn/radicals` content while it still answers 200,
   show `verify.sh` failing, then revert.
3. **What you did NOT verify.**
4. **The provenance report from item 5**, quoting whatever the app records.

Do not claim success without pasted command output.
