# 001 — Build the landing page

**Linear:** `GOC-5`

## Plain English

This repository is the public face of the company and it currently has no front page. Vercel is
connected and deploying, but there is nothing to deploy, so the production URL returns a 404.

This ticket builds the landing page: one page that presents the four demo applications, says what
each one is, and links to whichever ones are actually live. It is also the first application in
the monorepo, so it brings the first `package.json` — which is what makes the dependency guard and
the per-app gate start doing real work instead of passing on an empty repository.

## Requirement

1. **A Next.js App Router application at the repository root**, in the same stack family as the
   other demos: TypeScript strict, Zod for any route-handler schema, Vitest, ESLint, Prettier.

2. **`GET /api/health`** returns JSON `{"ok": true, "service": "gocklkatz"}`.

3. **The home page presents one card per application**, in this order:

   | Demo | One-line description | Deployment |
   | --- | --- | --- |
   | Ameisenwerkstatt | Ant colony optimization on a fixed TSP, with a live 3D workspace. | not yet deployed |
   | Bienenstock | Bee colony simulation — hive and foraging, rendered in 3D. | not yet deployed |
   | Simplified | Learning and practising simplified Chinese characters. | not yet deployed |
   | Arbeitsmarkt | Relevance-ranked IT job listings from public APIs. | not yet deployed |

   Every card carries a **status field** with exactly one of two values: `live` or `in-development`.
   At the time of writing all four are `in-development`, which is the expected starting state.

4. **Link rules — this is the requirement that matters.**

   * A card whose status is `live` **must** link to its deployment URL.
   * A card whose status is `in-development` **must not link anywhere.** It renders its status
     label and no anchor. A card that links to a deployment that does not exist is a dead link on
     the front page of the portfolio, which is worse than no card at all.

   The four URLs are fixed now, so a card can be flipped from `in-development` to `live` by
   changing one value:

   | Demo | Deployment URL when live |
   | --- | --- |
   | Ameisenwerkstatt | `https://gocklkatz-ameisenwerkstatt.vercel.app` |
   | Bienenstock | `https://gocklkatz-bienenstock.vercel.app` |
   | Simplified | `https://gocklkatz-simplified.vercel.app` |
   | Arbeitsmarkt | `https://gocklkatz-arbeitsmarkt.vercel.app` |

5. **Cards are data, not markup.** The four cards come from a single typed list in one module, so
   adding a fifth demo is one entry and not an edit to JSX. The card component renders whatever
   the list contains.

6. **The page must not be empty-looking.** It needs a clear product identity (the company name and
   what the portfolio is), the cards, and a footer carrying the license and the repository link.
   It is the portfolio home; a bare list of four grey boxes is not acceptable.

7. **`scripts/ci.sh`** runs lint, typecheck, tests and build — the same gate shape the other apps
   use, so `repo.config` can treat it identically.

8. **`scripts/verify.sh`** proves the app *runs*, which `scripts/ci.sh` cannot:

   * build, then start the server;
   * wait for the port to accept connections rather than assuming it is up;
   * fetch `/` and `/api/health`;
   * assert `/` is HTTP 200 and that its body contains all four demo names;
   * assert `/api/health` is HTTP 200 and parses as JSON with `"ok": true`;
   * **assert the link rules from requirement 4**: every card that renders an anchor resolves to a
     URL that is HTTP 200, and no card with status `in-development` renders an anchor at all;
   * always shut the server down, including on failure, and exit non-zero on any failure.

   Plain `curl` or Node's `fetch` is enough. Do **not** add a browser driver: that is a policy
   decision this ticket does not make.

9. **Register the app** in `repo.config` in the same commit, so the gate and CI build and verify
   it:

   ```yaml
   apps:
     - name: gocklkatz
       path: .
       enabled: true
       verify_cmd: bash scripts/verify.sh
   ```

   If the gate's app check cannot express a root-path app, extend the gate to support it rather
   than special-casing this app elsewhere.

10. **Any package this needs must be on `docs/DEPENDENCY_ALLOWLIST.md`** in the same commit.
    `node tools/check-deps.mjs` must pass. The root list already carries `next`, `react`,
    `react-dom` and `zod`.

## Acceptance criteria

**A-1 — the app passes its own gate.**
```bash
bash scripts/ci.sh
```
Exits `0`: lint, typecheck, tests, build.

**A-2 — the served app works.**
```bash
bash scripts/verify.sh
```
Exits `0`, and its output shows which routes and which cards it checked.

**A-3 — the gate covers the app.**
```bash
bash tools/gate.sh
```
Exits `0` and its `==> applications` section reports the app's `scripts/ci.sh` and its verify as
`ok`, not `skip`.

**A-4 — the dependency guard is no longer vacuous.**
```bash
node tools/check-deps.mjs
```
Exits `0` **and** prints a per-manifest summary for the root `package.json` rather than
`no package.json manifests found`.

**A-5 — no dead links, demonstrated rather than asserted.**
Temporarily set a card to `live` with a URL that does not resolve, then:
```bash
bash scripts/verify.sh
```
Exits non-zero and names the offending card. Revert afterwards. This is the criterion that proves
the link check is real; a link check that has never been seen to fail is not a link check.

**A-6 — the all-tests-in-one-place command still passes.**
```bash
bash tools/gate.sh
```
Exits `0` with the app present. (The root-level suite that ran before this ticket must not be
broken by adding the first app.)

## Out of scope

* The four demo applications themselves.
* Screenshots, video, and OG images for the cards. Text and status only.
* Analytics, cookie banners, contact forms, i18n.
* Any content management — the card list is code.
* Making the demos deploy. Each demo's own ticket does that.

## Risks / notes

* **This is the first real deploy.** Per-project Root Directory is specified in `docs/DEPLOY.md`
  but has never been exercised. Expect to learn something about how Vercel handles this repo;
  record it there when you do.

* **Port selection.** The Ameisenwerkstatt app binds 43123. Pick a distinct port here and make
  `verify.sh` fail cleanly if it is already in use, so `verify.sh` runs cannot collide.

* **`repo.config` may not support a root-path app.** If `path: .` does not work in
  `tools/gate.sh`, that is a gap in the gate, not a reason to skip requirement 9.
