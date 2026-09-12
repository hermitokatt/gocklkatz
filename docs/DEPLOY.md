# Deploy and CI

Each app is a separate Vercel project pointing at its own root directory in this repository.

| Vercel project | Root Directory | Live URL |
| --- | --- | --- |
| `gocklkatz` | `.` | — |
| `gocklkatz-ameisenwerkstatt` | `apps/ameisenwerkstatt` | — |
| `gocklkatz-bienenstock` | `apps/bienenstock` | — |
| `gocklkatz-simplified` | `apps/simplified` | — |
| `gocklkatz-arbeitsmarkt` | `apps/arbeitsmarkt` | — |

A URL is recorded here only once it has been fetched and returned `200`.

## Why one project per app

One build per app, so a broken demo cannot take down the landing page, and each demo can be
shared, rolled back, and rebuilt on its own. This requires setting **Root Directory** and
**Ignored Build Step** per project in the Vercel UI, so that a commit touching only
`apps/simplified` does not rebuild the other four.

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
bash tests/guard.test.sh    # 13 cases, five of them must-fail
bash tests/gate.test.sh     # 8 cases, five of them must-fail
```

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

## Publishing

```bash
bash tools/mirror-to-github.sh          # dry run: report what would change
bash tools/mirror-to-github.sh --push   # publish
```

The script refuses to publish from a dirty tree, so what is published is always a state that has
passed the local gate. It pushes the `main` branch explicitly rather than using `--mirror`,
because `--mirror` would also publish Origin's internal pull-request refs, which are not part of
the public history.

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

Expect a single `refs/heads/main`, matching the local `main`. No `refs/pull/*` should appear: if
one does, something published more than the branch.

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

The check that keeps this honest is `GOC-46`: fetch every **published** URL anonymously and treat a
`302` to an authentication host as failure rather than following it. Published means the custom
custom domains in the table above, not the deployment URLs.

`live: false` on the project is a separate flag and does not mean the site is down — it reflects
that no deployment is currently aliased as the project's live production in the way the API
reports it. The URL above is the evidence that matters.

### Creating an application project

Each application is its own Vercel project pointing at its own root directory, created with the
Vercel MCP `create_git_project`, which takes the repository, the provider and the root directory.
`provider: cursor-origin` links the project to the Origin repository directly, so a **merge to
`main` is what deploys** — there is no separate deploy step.

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
| `gocklkatz-bienenstock` | `apps/bienenstock` | `gocklkatz-bienenstock.vercel.app` | to attach |
| `gocklkatz-simplified` | `apps/simplified` | `gocklkatz-simplified.vercel.app` | to attach |
| `gocklkatz-arbeitsmarkt` | `apps/arbeitsmarkt` | `gocklkatz-arbeitsmarkt.vercel.app` | to attach |

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
