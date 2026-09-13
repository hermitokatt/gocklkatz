# Deploy and CI

Each app is a separate Vercel project pointing at its own root directory in this repository.

| Vercel project | Root Directory | Live URL |
| --- | --- | --- |
| `gocklkatz` | `.` | `gocklkatz.vercel.app` |
| `gocklkatz-ameisenwerkstatt` | `apps/ameisenwerkstatt` | `gocklkatz-ameisenwerkstatt.vercel.app` |
| `gocklkatz-bienenstock` | `apps/bienenstock` | `gocklkatz-bienenstock.vercel.app` |
| `gocklkatz-simplified` | `apps/simplified` | `gocklkatz-simplified.vercel.app` |
| `gocklkatz-arbeitsmarkt` | `apps/arbeitsmarkt` | `gocklkatz-arbeitsmarkt.vercel.app` |

A URL is recorded here only once it has been fetched and returned `200`. The three recorded above
were each fetched anonymously; the deployment and branch aliases for the same projects answer `302`
to an authentication host and are deliberately not listed, because they are not addresses a visitor
can open.

## Why one project per app

One build per app, so a broken demo cannot take down the landing page, and each demo can be
shared, rolled back, and rebuilt on its own. This requires setting **Root Directory** and
**Ignored Build Step** per project in the Vercel UI, so that a commit touching only
`apps/simplified` does not rebuild the other four.

## Deploying is not part of the delivery loop

The loop is six steps and ends at the mirror (`AGENTS.md` §12):

```
branch → gate → PR → Gate green → local merge --no-ff → push origin main → mirror to GitHub
```

Nothing in it waits for a deployment, verifies one, or pushes again to force one. A merge to `main`
may produce a deployment and may not; either way the task is finished. **A human deploys, or a human
asks for a deployment by name.**

When a deployment does happen, it belongs to a **whole finished issue**, not to each sub-issue that
merged into it. An epic's deploy-facing work — the app's Vercel project, its custom domain, and the
landing-page card flip — belongs to the sub-issue that closes the epic. The sub-issues build up to a
deployment; they do not each earn one.

### Why: over-deploying does not refuse a build, it makes the next ones look broken

This was measured, and it cost a working day, which is the reason the rule is this absolute rather
than a preference for tidiness.

On 2026-09-12, deploying per sub-issue produced four or five preview builds per pull request and
created five projects in one working day, reaching **two separate Vercel limits within hours**:
`api-deployments-free-per-day` (100) on the API deploy path, and `build-rate-limit` on concurrent
builds.

What the second one looks like from outside is the trap. A push produces no deployment, the previous
build keeps serving, and no log says why. That is indistinguishable from a broken git connection, a
wrong production branch, an ignored-build-step polarity bug, or a stuck project — all four of which
were investigated, and committed as diagnoses, before the real cause was found. Each retry, and each
empty commit pushed to force a rebuild, spent more of the budget that was already exhausted.

The fix is not to configure more. It is to deploy less, and to stop the loop before it reaches a
deployment at all.


---

# The quality gate

There are three layers. They are not redundant: each catches something the others cannot.

## 1. Local pre-flight gate — `bash tools/gate.sh`

Runs on the machine before code leaves it. Checks the content guard, repository hygiene, and
every app declared in `repo.config` (its `scripts/ci.sh`, and its `verify_cmd` where declared).
Writes `var/gate/report-<tree>.txt`.

**It is bound to the git tree, not to a commit message.** The report is keyed by
`git rev-parse HEAD^{tree}`, and `.githooks/pre-push` refuses to push unless a passing report
exists for the exact tree being pushed. Commit, run the gate, push.

`.githooks/pre-push` is the enforcement point, because until Depot reports a check on Origin
there is no server-side rule that can stop a bad push.

Enable the hooks once per clone:

```bash
git config core.hooksPath .githooks
```

The gate has self-tests for the guards themselves, because a guard that passes by doing nothing
looks identical to a guard that passes:

```bash
bash tests/guard.test.sh    # 16 cases, nine of them must-fail
bash tests/gate.test.sh     # 8 cases, five of them must-fail
```

"Must-fail" is the count of cases whose pass condition is that the guard **failed**. Both numbers
were read off a run rather than off the test names; the count in this file said five for the guard
until it was checked.

## 2. Depot CI — the enforced server-side check

This repository is **Origin-hosted**, not a GitHub mirror. A GitHub Actions workflow committed
here does not execute. [Depot CI's Origin integration](https://depot.dev/docs/ci/integrations/origin)
runs Actions-format workflows on Depot compute, triggered by Origin pushes and pull requests,
and **reports job results back onto the Origin pull request**, where a branch-protection rule can
require them. It is in early beta.

Connected organization: **Gocklkatz** (`p8js5cbzbp`). Preflight confirmed access:

```bash
depot ci migrate preflight --forge=origin --org p8js5cbzbp
# Detected repository: origin.cursor.com/gocklkatz/gocklkatz
# Cursor Origin repository is available to this Depot organization.
```

The executing workflow is `.depot/workflows/ci.yml`. It is generated from
`.github/workflows/ci.yml` by:

```bash
depot ci migrate workflows --forge=origin --org p8js5cbzbp --overwrite --yes
```

`.github/workflows/ci.yml` is the **source** for the Depot copy, not a gate of its own. Depot
generates `.depot/workflows/ci.yml` from it, so edit the `.github/` file and regenerate. Nothing
runs from `.github/` on this host.

### Required setup

- [ ] In Origin **Settings → Rules and Protections**, on the `main` **merging** ruleset, enable
      **Require status checks** and select the **`Gate`** check. Until this is done, Depot
      *reports* but does not *block*.

### The check identity is scoped to the trigger — this is the trap

**A check is not matched by name alone.** Origin identifies it by name *and* the event that
produced it. Read the required check back with:

```bash
origin api /repos/gocklkatz/gocklkatz/rulesets
```

It must contain:

```json
{"name":"Gate","actorId":"app_01kxpr1vv7e1yvr5trn777f800","groupKey":"pull_request:ci.yml"}
```

**The group MUST be `pull_request:ci.yml`.** This workflow triggers on both `push` and
`pull_request`, so it reports two distinct checks that both display as a bare `Gate` with a Depot
icon. They are indistinguishable in the picker. The `push:ci.yml` one is the wrong choice:

```
"message": "Required status checks are missing.",
"checkNames": ["Gate (app/app_01kxpr1vv7e1yvr5trn777f800/push:ci.yml)"]
```

That message appears while `origin pr checks` shows the check passing — the gate is green and the
merge is still blocked, with no bypass actor to override it. To tell the entries apart, look at a
run's detail: the correct one is `Trigger: pull_request`, `Path: ci.yml`; the wrong one is
`Trigger: push`.

### Other traps in this area

**Stale `CI` entries in the picker.** The picker lists checks from the last 30 days. An earlier
revision of this workflow was named `CI`, so `CI` entries can still appear. Never select them.

**Never use `depot ci run --workflow` on this repository.** It dispatches through the API, which
registers a check with no workflow path — a phantom check under the workflow's name. That is how
two identically named `CI` checks appeared in the first place. To test the workflow, push a
branch or open a pull request.

**Keep a bypass actor.** With `require_status_checks` active and no bypass, a check that never
reports makes `main` permanently unmergeable, and only a settings change can recover it. This has
already happened once here.

**Reporting is not enforcing.** A check that appears on a pull request but is not required by a
ruleset is decoration.

## 3. Application-level verification

`scripts/ci.sh` inside an app proves it builds, lints, typechecks and passes unit tests. It does
**not** prove the app works. A build passes with a card linking to a 404.

That is what `verify_cmd` in `repo.config` is for: it must start the app, probe its real HTTP
surface, and exit non-zero on failure. An app with no `verify_cmd` is reported as a `skip` by the
gate, by name, rather than silently passing.

### Verify ports

Each app's `scripts/verify.sh` starts a real server, so the ports must not collide: the gate runs
the apps one after another, but a stray server from an interrupted run would break the next one.
Every `verify.sh` refuses to run when its port is already bound, rather than probing a server it
did not start.

| App | Verify port |
| --- | --- |
| landing page (root) | 43124 |
| `apps/ameisenwerkstatt` | 43123 |
| `apps/simplified` | 43125 |
| `apps/bienenstock` | 43126 |
| `apps/arbeitsmarkt` | 43127 |

Claim the next free port in this table when you add an app.

## Known gap

Nothing re-runs the local gate later. A report that passed at tree `X` says nothing about tree
`Y`, which is why the report is keyed by tree — but a tree that was never gated has no report at
all, and the pre-push hook is the only thing that notices. `git push --no-verify` bypasses it.

---

# Public mirror on GitHub

Origin is the working repository and the only place anything is written. The GitHub repository is
a **public window**, published one-way from here:

```
https://github.com/hermitokatt/gocklkatz
```

Origin repositories cannot be made public on this account — the API accepts `visibility=internal`
and `visibility=private` but rejects `visibility=public`, which is why the public copy lives on
GitHub instead.

## Repository metadata

GitHub's description, homepage and topics are settings on the public copy, not files inside it, so
they are recorded here for the same reason the Vercel project settings are recorded further down: a
repository recreated from this one can be configured from the same commit that configures
everything else. `tools/mirror-to-github.sh` pushes the `main` branch and never touches repository
settings, so nothing here is applied automatically and nothing gets overwritten by a publication.

The block below **is** the record, and `tools/audit-mirror-metadata.mjs` reads it. Machine-readable
rather than prose for the same reason `docs/LINK_AUDIT.md` carries its rows in a block: a check that
parses prose breaks when someone rewraps a line, and one that silently finds nothing is not a check.

<!-- BEGIN MIRROR_METADATA -->
repository: hermitokatt/gocklkatz
description: Gocklkatz Inc — engineering portfolio: a landing page and four self-contained demo applications (ant colony optimisation, a bee colony, Chinese radicals, job listings), each built, tested and deployed on its own.
homepage: https://gocklkatz.vercel.app
topics: monorepo, nextjs, portfolio, simulation, typescript
<!-- END MIRROR_METADATA -->

The homepage was fetched anonymously and answers `200`, like every other published URL in this
document. Set by hand, 2026-09-12.

Apply the record:

```bash
gh repo edit hermitokatt/gocklkatz \
  --description "Gocklkatz Inc — engineering portfolio: a landing page and four self-contained demo applications (ant colony optimisation, a bee colony, Chinese radicals, job listings), each built, tested and deployed on its own." \
  --homepage "https://gocklkatz.vercel.app" \
  --add-topic monorepo --add-topic nextjs --add-topic portfolio \
  --add-topic simulation --add-topic typescript
```

Check that the live copy still matches the record:

```bash
node tools/audit-mirror-metadata.mjs
```

It exits **0** when they agree, **1** when they differ — naming each field with both values, and
reporting a topic present on only one side in either direction — and **2** when it could not read
one side at all: no `gh`, no credentials, no network, or a record it cannot parse. Code 2 is
deliberately distinct from 0, because a check that reports agreement without having read both sides
is worse than no check.

It is **not** part of `tools/gate.sh`: a CI runner has none of `gh`, credentials or network. Like
[`tools/verify-live.sh`](../tools/verify-live.sh) and
[`tools/verify-deployments.sh`](../tools/verify-deployments.sh), it is a check to run when asked.

## Publishing

```bash
bash tools/mirror-to-github.sh          # dry run: report what would change
bash tools/mirror-to-github.sh --push   # publish
```

The script refuses to publish from a dirty tree, so what is published is always a state that has
passed the local gate. It pushes the `main` branch explicitly rather than using `--mirror`,
because `--mirror` would also publish Origin's internal pull-request refs, which are not part of
the public history. Release tags go the same way — one ref at a time, matched by `MIRROR_TAG_GLOB`
(default `v*`), never `--tags`, which would publish every local tag including anything experimental.

## Releases

A release is an **annotated tag** on the commit that was declared, named `v<major>.<minor>.<patch>`.
It is the one marker that cannot drift from what it points at: a `CHANGELOG` can be edited and a
README line can go stale, but a tag names a commit and no later commit can change it.

Cut a tag deliberately, not per change — the same kind of act as a deployment (`AGENTS.md` §12).
Then publish it with the mirror:

```bash
git tag -a v1.0.0 <commit> -m "..."      # annotate: a lightweight tag carries no message or date
git push origin refs/tags/v1.0.0         # Origin is the code source of truth, so the tag goes
                                         # there first — a release that exists only on the mirror
                                         # would leave a clone of Origin with no marker at all
bash tools/mirror-to-github.sh --push    # publishes the branch and any unpublished release tag
```

**A published tag is a fixed point.** The mirror never uses `--force` on one; re-cutting a release
means a new tag, not an edited one, because a reader may already have fetched the old one.

| Release | Commit | Declared | Record |
| --- | --- | --- | --- |
| `v1.0.0` | `9593c9765f620ce5a9fcaeb3da1c3a038786ce10` | 2026-09-12 | `GOC-51` |

## Why one-way, and why a script rather than a workflow

**One-way matters.** Origin's history is the one that carries the gated commits; publishing from
the public copy back into Origin would let ungated commits in through the back door. Nothing is
ever committed to GitHub directly, so the public copy cannot drift from the gated copy.

**A GitHub Actions workflow would defeat itself.** This repository is mirrored in full, so a
workflow published here also exists in the GitHub repository and would attempt to mirror GitHub
into itself. Running the publication from the trusted copy removes that problem entirely.

## Verify

```bash
git ls-remote https://github.com/hermitokatt/gocklkatz.git
```

Expect `refs/heads/main`, matching the local `main`, plus one `refs/tags/<release>` per published
release — and nothing else. No `refs/pull/*`: if one appears, something published more than the
branch.

`git ls-remote` prints an extra `<sha>\trefs/tags/<release>^{}` line for each **annotated** tag. That
is the commit a tag peels to, not a second ref, so a release shows two lines and not one:

```
6e26aee…    HEAD
6e26aee…    refs/heads/main
71f11f9…    refs/tags/v1.0.0
9593c97…    refs/tags/v1.0.0^{}     <- the peeled commit, not another release
```

---

### The framework preset, and why it is declared in the repository

The `gocklkatz` Vercel project was created with **no framework preset**, which Vercel represents as
`"framework": null` — the `Other` preset. With no preset, Vercel does not know a Next.js app emits
`.next/`, so it expects a static `dist/` directory and fails the deployment *after* a successful
build:

```
✓ Generating static pages using 1 worker (4/4) in 135ms
Error: No Output Directory named "dist" found after the Build completed.
```

The build was never the problem. The preset was.

`vercel.json` at the repository root declares it, per Vercel's own documented example for
overriding a framework preset:

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "framework": "nextjs" }
```

This lives in the repository rather than only in the project settings because the repository is the
source of truth for how the app builds: a recreated Vercel project is then configured by the same
commit that configures the app, and the setting is reviewable in a pull request.

The settings-side equivalent is `vercel project update --framework nextjs`.

### The settings each project actually uses

Read back from the Vercel API and from a production build log, for the `gocklkatz` project. The four
app projects differ only in **Root Directory**, which is why that column is the one to check first
when a build behaves oddly.

| Setting | Value | Where it lives |
| --- | --- | --- |
| Root Directory | `.` (apps: `apps/<name>`) | project settings (UI) |
| Framework Preset | `nextjs` | repository, via `vercel.json` — see above |
| Node.js Version | `24.x` | project settings (UI) |
| Build Command | framework default (`next build`) | not overridden |
| Install Command | framework default (`npm install`) | not overridden |
| Output Directory | framework default (`.next`) | not overridden |
| Production Branch | `main` | project settings (UI) |
| Ignored Build Step | **not readable through the API** | project settings (UI) |
| Deployment Protection | `ssoProtection: all_except_custom_domains` | project settings (UI) |

Three of these are worth stating plainly rather than leaving to be discovered:

* **`framework` in the API is not the effective preset.** `get_project` still reports
  `"framework": null` — the `Other` preset — for `gocklkatz` while it deploys correctly, because
  `vercel.json` declares Next.js and the repository wins. Do not "fix" the null by chasing it; the
  settings-side equivalent above is optional tidying.
* **A production build log is the authority on whether the repository is at fault.** The current one
  reads `✓ Compiled successfully`, then four routes, then `Deployment completed` — no error lines,
  only an `npm warn allow-scripts` notice about `unrs-resolver`.
* **The Ignored Build Step is invisible to every check we have.** It is the one setting that can stop
  deployments with no error anywhere, and its polarity differs between production and preview.

### The Ignored Build Step, and the trap in its exit code

Read from Vercel's knowledge base: the command's **exit code is inverted relative to what you would
guess**. Returning **`0` skips the build**; returning **`1` or greater builds it**:

> If the command returns "0", the build will be skipped. If, however, a code "1" or greater is
> returned, then a new deployment will be built.

Two consequences for a monorepo, both of which have bitten this project:

1. **Vercel shallow-clones**, `git clone --depth=10`, so a rule that diffs against history has ten
   commits to work with and no more.
2. **The polarity is not the same for production and preview.** A rule that is correct for previews
   can evaluate to "skip" on the production branch and silently stop production deployments while
   previews keep building. That signature — previews green, production frozen, no error in any log —
   is what this project showed for about four hours on 2026-09-12, and it is the reason the ignored
   build step is called out here rather than being left to the UI.

**Nothing is configured for these projects, and nothing is going to be.** The field is unset on all
five, by decision — see "Deliberately not configured" below. The trap recorded here still matters,
because the field remains the one setting that can stop deployments with no error anywhere, and
because a rule that is ever switched on has to be checked against a production deployment and not
only a preview.

### Deployment protection covers deployment URLs, not custom domains

Read back from the Vercel API:

```json
"domains": ["gocklkatz.vercel.app", "gocklkatz-gocklkatz.vercel.app", "gocklkatz-git-main-gocklkatz.vercel.app"],
"ssoProtection": { "enabled": true, "deploymentType": "all_except_custom_domains" }
```

`all_except_custom_domains` means exactly that. Production is reached through the **custom domain**
`gocklkatz.vercel.app`, which is excluded from the protection and answers `200` to an anonymous
request:

```
$ curl -s -o /dev/null -w '%{http_code}' https://gocklkatz.vercel.app/
200
$ curl -s https://gocklkatz.vercel.app/api/health
{"ok":true,"service":"gocklkatz"}
```

The **deployment** URLs — the hashed ones and the `-git-main-` branch alias — are covered and
answer `302` to `vercel.com/sso-api`. That is the intended behaviour, and it is recorded here so
that a `302` on such a URL is not mistaken for a broken deployment. `gocklkatz-gocklkatz.vercel.app`
in the list above is a custom domain and is therefore excluded, which is why it answers `200`.

The check that keeps this honest is [`tools/verify-live.sh`](../tools/verify-live.sh) (GOC-46). It
fetches every **published** URL anonymously and treats a `302` to an authentication host as failure
rather than following it. Published means the custom domains in the table above, not the deployment
URLs.

```bash
bash tools/verify-live.sh
```

```
verify-live: 5 URL(s)
date:        2026-09-12T20:32:50Z
fetched:     anonymously, following no redirects

  ok    landing page — 200, contains 'Gocklkatz Inc' (18557 bytes): https://gocklkatz.vercel.app/
  ok    Ameisenwerkstatt — 200, contains 'Werkstatt' (8243 bytes): https://gocklkatz-ameisenwerkstatt.vercel.app/
  ok    Simplified — 200, contains 'Simplified' (9107 bytes): https://gocklkatz-simplified.vercel.app/
  ok    Bienenstock — 200, contains 'Bienenstock' (9692 bytes): https://gocklkatz-bienenstock.vercel.app/bienen
  ok    Arbeitsmarkt — 200, contains 'Synthetic' (30340 bytes): https://gocklkatz-arbeitsmarkt.vercel.app/arbeitsmarkt

verify-live: PASS (5 URL(s) reachable anonymously, each serving its own content)
```

The byte counts and the timestamp move between runs — the check asserts the status code and the
rendered string, not the size. Treat those two columns as illustrative and the `ok`/`FAIL` line as
the claim.

It is not a status check. Two things it does that a dashboard cannot: it never follows a redirect, so
a gated URL cannot land on a login page and answer `200`; and it asserts a string each application
renders, so an error page cannot pass either. The negative fixture is one of the project aliases,
which `ssoProtection` deliberately gates:

```bash
bash tools/verify-live.sh --expect-fail \
  --url https://gocklkatz-gocklkatz.vercel.app/ "Gocklkatz Inc"
```

```
  FAIL  ad-hoc URL — 302 to an authentication host, so a visitor gets a login: …
verify-live: 1 of 1 failed, as expected — the check tells gated from published
```

`--expect-fail` inverts the exit code, so this passes only when something failed. Without it the same
run exits `1`, which is how the check fails a real outage.

### Verifying the deployments themselves — `tools/verify-deployments.sh`

`verify-live.sh` answers "can a stranger open this, or does protection hand them a login?" one URL per
project. [`tools/verify-deployments.sh`](../tools/verify-deployments.sh) (GOC-44) answers a different
question: **is each route of each deployed application serving what that app actually renders?**

```bash
bash tools/verify-deployments.sh
```

```
verify-deployments: 20 route(s)
date:               2026-09-12T20:33:00Z
fetched:            anonymously, bodies asserted

  ok    200  https://gocklkatz.vercel.app/  (18557 bytes, contains 'Gocklkatz Inc')
  ok    200  https://gocklkatz.vercel.app/api/health  (33 bytes, contains '{"ok":true,"service":"gocklkatz"}')
  ok    200  https://gocklkatz-ameisenwerkstatt.vercel.app/ameisen  (11509 bytes, contains 'Ameisenfabrik')
  ok    200  https://gocklkatz-simplified.vercel.app/learn/radicals/person  (14505 bytes, contains 'person; people')
  ok    200  https://gocklkatz-bienenstock.vercel.app/bienen  (9692 bytes, contains 'data-bienen-scene')
  ok    200  https://gocklkatz-arbeitsmarkt.vercel.app/arbeitsmarkt/operations  (39309 bytes, contains 'data-alarm-state')
  … 14 further routes, one line per route across the landing page and all four demos
verify-deployments: PASS (20 route(s) across every live deployment, each serving its own content)
```

As with `verify-live.sh`, the byte counts and timestamp move between runs and are not what is
asserted; the status code and the body string are.

**Why both checks exist.** A host can answer `200` while a route `500`s; a route can answer `200` with
an error page or an empty shell; and a project can be gated so nobody sees any of it. Neither check
subsumes the other, and the health endpoints are asserted on their JSON body rather than their status,
so an app answering the wrong service name fails.

Seen to fail, in both directions:

```bash
bash tools/verify-deployments.sh --url https://no-such-host.invalid/ "anything"
  FAIL  https://no-such-host.invalid/ — no response (host does not resolve, or the connection failed)

bash tools/verify-deployments.sh --url https://gocklkatz.vercel.app/ "Ameisenfabrik"
  FAIL  https://gocklkatz.vercel.app/ — HTTP 200 but the body does not contain 'Ameisenfabrik'
```

The second is the case a status check cannot catch: the host is healthy and the content is wrong.

Neither script triggers a deployment. They read what is already published, which is why they can run
as often as you like. Neither is a finishing step for a change: the delivery loop ends at the mirror
and contains no deployment, so these are health checks to run when a human asks for one — and when a
deployment is behind, they fail for that reason rather than because the change is wrong.

`live: false` on the project is a separate flag and does not mean the site is down — it reflects
that no deployment is currently aliased as the project's live production in the way the API
reports it. The URL above is the evidence that matters.

### What decides whether a project rebuilds — `tools/vercel-ignore.sh`

Five applications, five projects, and each **would** rebuild only when its own code changes, if the
rule below were configured. It is not, and that is a decision rather than an omission: see
"Deliberately not configured" at the end of this section.

The rule is one line per project, pasted into its **Ignored Build Step** field (Settings → Git):

| Vercel project | Root Directory | Ignored Build Step |
| --- | --- | --- |
| `gocklkatz` | `.` | `bash tools/vercel-ignore.sh .` |
| `gocklkatz-ameisenwerkstatt` | `apps/ameisenwerkstatt` | `bash tools/vercel-ignore.sh apps/ameisenwerkstatt` |
| `gocklkatz-simplified` | `apps/simplified` | `bash tools/vercel-ignore.sh apps/simplified` |
| `gocklkatz-bienenstock` | `apps/bienenstock` | `bash tools/vercel-ignore.sh apps/bienenstock` |
| `gocklkatz-arbeitsmarkt` | `apps/arbeitsmarkt` | `bash tools/vercel-ignore.sh apps/arbeitsmarkt` |

**The exit code is inverted, and that is why this is a script rather than a one-liner.** Vercel skips
the build when the command returns **`0`** and builds when it returns **`1` or greater** — the
opposite of how "ignored build step" reads. A rule written the intuitive way round silently skips
precisely the deployments it was meant to make, and its polarity is reported to differ between
production and previews, so it can look correct on pull requests while production stops. Every path in
`tools/vercel-ignore.sh` returns through `build` or `skip`, never a bare `exit`.

**Why each app is an island.** No application imports, reads or builds from anything outside its own
directory — each has its own `package.json`, lockfile, tests and gates. So a change confined to
`apps/<name>` cannot affect a sibling, and the rule is a directory comparison rather than a
dependency graph.

**The landing page is the exception, and the interesting one.** Its root directory is the repository
root, so `git diff -- .` matches every path: a rule that only asked "did anything change?" would
rebuild the landing page for every sub-issue of every epic while the apps rebuilt for none. Its set is
therefore an explicit subtraction — everything except `apps/`, `docs/`, and the root prose
(`README.md`), none of which is an input to its build.

#### Verified, without touching Vercel

The rule takes a base and a head and answers for that range, which is what makes it testable without
Vercel at all:

```bash
bash tools/vercel-ignore.sh <root> <base-sha> <head-sha>
```

`tests/vercel-ignore.test.sh` asserts both directions of the polarity. It builds its **own** git
repositories and commits in a temporary directory, so no case depends on this clone's history or on
the network — an earlier version used real commits from this repository and passed locally while
failing in CI, because `actions/checkout` clones shallowly and those commits were not there:

```
vercel-ignore self-test (bash 3.2.57)

  --- a docs-only commit skips every project ---
  ok   . skips on a docs-only commit
  ok   apps/alpha skips on a docs-only commit
  ok   apps/beta skips on a docs-only commit

  --- a landing-page file rebuilds the landing page only ---
  ok   landing page builds on its own file
  ok   alpha skips when only the landing page changed
  ok   beta skips when only the landing page changed

  --- an app change rebuilds that app, not its sibling ---
  ok   alpha builds on its own change
  ok   beta skips when alpha changed
  ok   the landing page skips when only an app changed

  --- a root config change rebuilds the landing page ---
  ok   landing page builds on a root config change
  ok   alpha skips on a root config change

  --- misuse must BUILD, never skip ---
  ok   no argument is misuse (exit 2, not a silent skip)
  ok   an unresolvable base is reported as build, not skip
  ok   an empty change set skips, and says so

vercel-ignore self-test: 14 passed, 0 failed
```

One property is deliberate and tested. An **unreadable state builds**: Vercel clones shallowly, so
without a parent commit the rule builds rather than skipping, because an unnecessary build costs a
minute while a wrongly skipped build costs a deployment nobody notices is stale.

#### Deliberately not configured

**The Ignored Build Step is unset on all five projects, and that is a decision, taken by the
repository owner on 2026-09-12. Do not paste the lines above into Vercel.** GOC-43, which asked for
this, was closed as not worth doing rather than done.

The reasoning, so it is not re-opened from the same argument: the rule's only benefit is fewer
builds. Depot CI and Vercel are both on free tiers, so a redundant build costs no money; and the
delivery loop no longer waits on a deployment (`AGENTS.md` §12), so a queued build cannot stall a
merge the way it did on 2026-09-12. Five project settings, each re-verified whenever the rule
changed, is not worth that.

One consequence is real and worth knowing: **a push to `main` still queues up to five builds**, one
per project, and every pull request produces five preview builds. On 2026-09-12 that volume is what
exhausted Vercel's build rate limit. It only mattered because the loop was waiting on deployments; it
is no longer, so the symptom is now invisible rather than harmful. If builds ever need to be reduced
for a reason other than money, this is the lever, and `tools/vercel-ignore.sh` is already written and
tested for it.

`tools/vercel-ignore.sh` and `tests/vercel-ignore.test.sh` are kept rather than deleted: the script
is correct, its polarity is covered in both directions, and the test runs in the gate. An unconfigured
rule with a tested implementation is cheaper to switch on than one that has to be rebuilt, and the
inverted exit code is exactly the trap this section exists to record.

### Creating an application project

Each application is its own Vercel project pointing at its own root directory, created with the
Vercel MCP `create_git_project`, which takes the repository, the provider and the root directory.
`provider: cursor-origin` links the project to the Origin repository directly, so a **merge to
`main` is what a deployment builds from** — there is no separate deploy command to run. That is a
statement about Vercel's trigger, not about the delivery loop: the loop ends at the mirror and does
not wait for the deployment this produces (`AGENTS.md` §12).

A project publishes several addresses and only some are public, so `get_project` is the thing to
read rather than the URL a deploy log happens to print. For `gocklkatz-ameisenwerkstatt` it reports
three, and only the first is public:

| Domain | What it is | Fetched anonymously |
| --- | --- | --- |
| `gocklkatz-ameisenwerkstatt.vercel.app` | the **custom domain** attached to the project | `200` |
| `gocklkatz-ameisenwerkstatt-gocklkatz.vercel.app` | project alias, `<project>-<team>` | `302` to `vercel.com/sso-api` |
| `gocklkatz-ameisenwerkstatt-git-main-gocklkatz.vercel.app` | branch alias | `302` |
| `gocklkatz-ameisenwerkstatt-<hash>-gocklkatz.vercel.app` | one per deployment (not in the list; created per build) | `302` |

Every one of those is a `*.vercel.app` address, and only one is reachable. So the rule is not about
the suffix and not about how official a name looks — it is about whether the address is a **custom
domain attached to the project**:

**`ssoProtection` is `all_except_custom_domains`. Anything that is not an attached custom domain is
gated.**

A project can therefore be built, deployed and serving while no visitor can reach it, because nobody
attached a domain yet. Fetched through Vercel's authenticated API such an app answers
`{"ok":true,"service":"demo-shell"}`, while the same URL fetched anonymously redirects to a login.

Attaching the domain is a UI step — the Vercel MCP exposes `buy_domain`, which purchases a new
domain, but nothing that attaches an existing address.

### The five projects

| Project | Root Directory | Custom domain | Status |
| --- | --- | --- | --- |
| `gocklkatz` | `.` | `gocklkatz.vercel.app` | attached |
| `gocklkatz-ameisenwerkstatt` | `apps/ameisenwerkstatt` | `gocklkatz-ameisenwerkstatt.vercel.app` | attached |
| `gocklkatz-bienenstock` | `apps/bienenstock` | `gocklkatz-bienenstock.vercel.app` | attached |
| `gocklkatz-simplified` | `apps/simplified` | `gocklkatz-simplified.vercel.app` | attached |
| `gocklkatz-arbeitsmarkt` | `apps/arbeitsmarkt` | `gocklkatz-arbeitsmarkt.vercel.app` | attached |

The domains are fixed in advance because each is already the URL on that demo's card in
`src/lib/demos.ts`. Attaching the named domain, then flipping the card, is the whole procedure for
adding an app — and the order is not optional: `scripts/verify.sh` fetches every anchor a `live`
card publishes, so promoting a card before its domain answers fails the gate. Correctly, because a
card linking to a login wall is not a live demo.

## Vercel ↔ Origin

Vercel connects to the Origin repository. Code source of truth is Origin; Vercel is the
production runtime and not a second source of truth.

Human-only steps (account and project linking, Root Directory, Ignored Build Step,
environment variables) are done in the Vercel and Origin UIs. No tokens, org IDs, project IDs,
or `.vercel` directories are ever committed to this repository.
