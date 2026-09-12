# AGENTS.md — working brief

You are working in the **Gocklkatz Inc** portfolio monorepo: a landing page plus four standalone
demo applications. This repository is **public**. Everything committed here is readable by anyone,
permanently.

Read this file for the standing contract. The ticket you are working from is the work order.

---

## 1. Identity — non-negotiable

Every commit in this repository is authored **exactly**:

```
Hermito Katt <gocklkatz@gmail.com>
```

The local git identity is already configured; do not change it. If you are an agent: **do not
create commits at all.** You commit nothing, you push nothing. Leave your work in the working
tree, and the orchestrator authors the commit. An agent-authored commit is a defect.

## 2. This repository is public — the bar

Anything committed must be fit for a stranger, a recruiter, and a client to read:

* No secrets, no credentials, no API keys, no `.env` values — not even a prefix, not even in
  logs or error messages.
* No absolute local paths. Repository-relative paths only.
* No personal identifiers of the author or the development machine — no personal name, no
  personal email domain, no home-directory username. `tools/guard.sh` enforces this and blocks
  the commit.
* No personal data of third parties. No scraped content. No data whose terms you have not read.
* No profanity, placeholder text, `TODO: fix this`, or debugging leftovers.
* Commit messages: professional, imperative, specific. They are part of the portfolio.
* If a document names a person, it is **Hermito Katt / Gocklkatz Inc**.

## 3. Structure

```
/                        landing page app (one card per demo)
LICENSE                  MIT, Gocklkatz Inc
AGENTS.md                this file
docs/tickets/            frozen requirements, one file per ticket
docs/                    deploy, architecture, portfolio notes
tools/worker-run.sh      runs one implementation pass with a stall watchdog
apps/<demo>/             one self-contained app per demo
repo.config              which apps the gate builds and verifies
```

Each app keeps its **own** `package.json`, lockfile, and `scripts/ci.sh`. There are no npm
workspaces. Do not hoist dependencies to the root, and do not make one app import from another.

## 4. Non-negotiables

These are the design, not preferences.

| Rule | Why |
| --- | --- |
| **No browser driver, no scraping framework in any app runtime.** | Rejected because the shipped demo acquires nothing, and installing them would put an acquisition tool into a repository whose rule is that no acquisition happens here; see `apps/arbeitsmarkt/docs/` for that reasoning. |
| **No app reads another app's files.** | Each demo deploys independently to its own Vercel project. |
| **No scraped data is ever committed or published.** `apps/arbeitsmarkt` renders synthetic data generated from a checked-in seed. | Publishing third-party listings is not in scope, for legal and terms-of-service reasons. |
| **Dependencies are added only by updating `docs/DEPENDENCY_ALLOWLIST.md` in the same commit, with a ticket.** | See §6. |
| **Never publish a number without its provenance.** | A measured claim with no run, command or date behind it goes stale silently. |
| **Never publish a link that has not been fetched.** | A homepage card pointing at a 404 is worse than no card. |

## 5. How to work

1. **Read the ticket.** It contains the requirement, the acceptance criteria as executable
   commands, and the out-of-scope list. If it is ambiguous, **stop and say so** — do not invent
   scope.
2. **Read what the change touches** before writing code.
3. **Implement it.**
4. **Prove it.** Run the acceptance commands named in the ticket. Paste raw output.
5. **Report** what you built, the exact commands you ran, the observed output, what you did
   **not** verify, and any decision the ticket did not cover.

**Never report success without pasted command output.** If a gate fails for a reason you did not
cause, say so rather than working around it.

## 6. The two rules that make guards real

**A guard that has never been seen to fail is not a guard.** Every check you add ships with
something that makes it fail, and you paste that failure. A configured rule is not an enforced
rule.

**A config flag must change behaviour, not just parse.** If a file says a thing is disabled or
prohibited, every part of the system that reads it must honour it. Parsing a flag and ignoring
it is worse than not having it, because it looks like a control.

## 7. Never trust a report — verify by running

**A report is a claim about the author's intent. The tree is the artefact.** Reports are written
in good faith and are still wrong about what they broke. Observed examples, each caught only by
an independent probe:

| Reported | Actually |
| --- | --- |
| "tests green" | an API key was being written to a log column in plaintext |
| "all acceptance passing" | an uncapped pagination pass aborted the primary source mid-run |
| "reproducible digest" | the scores were computed under a different profile hash entirely |
| "fires correctly" | the alarm fired on missing data for a source that had just collected 1,172 jobs |
| "verified end to end" | the guard's tracked-file scan was a silent no-op that reported "clean" |

For this repository:

* Green lint and green build do **not** mean the site works. A build passes with a card linking
  to a 404.
* The verification that matters is **running the thing**: build it, serve it, fetch every route
  and every link, assert the response.
* Fixtures encode the author's assumptions. Probe the real output.
* **Demand provenance on every claim**: command, commit, timestamp.

## 8. Stop and ask when

* the ticket is ambiguous or self-contradictory;
* acceptance criteria cannot be met as written;
* you are tempted to add a dependency, a fallback, or a per-page special case;
* anything would require committing a secret, third-party personal data, or scraped content;
* a guard you are asked to add cannot be made to fail.

Guessing silently is the failure mode this repository exists to prevent.

## 9. Tickets

Requirements live in `docs/tickets/`. They are **frozen before implementation starts** so that
nobody can retro-fit a requirement to whatever got built. Schema:
[`docs/tickets/FORMAT.md`](./docs/tickets/FORMAT.md).

## 10. Ownership

* **Orchestrator** — writes and freezes the ticket, runs the acceptance gate, authors commits,
  adjudicates findings. Owns the requirement.
* **Worker** — implements against the frozen ticket. Produces a tree, not a report.
* **Reviewer** — a fresh agent that receives the frozen criteria and the diff, and judges
  whether the work satisfies the requirement. It does not see the orchestrator's reasoning, so
  it does not inherit the orchestrator's assumptions.

Only a human merges. AI authors no commits.

## 11. Merging — and why the platform's merge button cannot be used

`main` accepts changes only through a pull request. This section records why the merge itself has
to happen outside the platform, because getting this wrong puts a foreign identity into published
history — and it has, twice.

**A pull request merged through the hosting platform produces a commit attributed to the account
that pressed the button.** Not to git config, and not to the author of the commits. Both
strategies behave this way, and this was measured rather than assumed:

* Merged as a **merge commit**: the new commit is authored and committed by the merging account.
* Merged as a **squash**: the platform writes a *new* commit with its own message (`… (#12)`) and
  attributes it to the merging account. The branch's original commits and their authorship are
  discarded.

So disabling merge commits changes the shape of the history and fixes nothing about attribution.
Every pull request merged in the UI carries somebody else's identity, and the audit catches it —
which means the gate fails on `main` after each merge.

**Therefore: merge locally, and push to `main`.** A local `git merge --no-ff` or a fast-forward
uses the configured identity and keeps the real commit message:

```bash
git checkout main && git pull --ff-only
git merge --no-ff <branch>        # or: git merge --ff-only <branch>
git push origin main
```

The repository runs the same gate either way: the branch carries the `Gate` check before merge,
and `tools/gate.sh` plus `.githooks/pre-push` run on the way out.

Two consequences to keep in mind:

* **`block_direct_updates` on `main` must be disabled** for this to be possible. The pull-request
  rule is what provides review; the direct-push block is what forces merges through the platform
  and therefore into the wrong identity.
* **`tools/guard.sh --audit-commits` checks the author and committer of every commit, merges
  included.** It runs in `tools/gate.sh`, so a commit carrying a foreign identity fails the gate.
  Excluding merge commits from that audit was itself a hole: one such merge reached `main` while
  the audit reported everything clean.

---

## 12. The delivery loop ends at the mirror

This is the whole loop. It has six steps and then it is finished:

```
branch → gate → PR → Gate green → local merge --no-ff → push origin main → mirror to GitHub
```

**Then stop.** The mirror is the end of the loop, not the middle of it.

**Deploying is not part of the loop.** A merge to `main` may or may not produce a deployment,
depending on settings this repository does not control. That is not the loop's business:

* Do not wait for a deployment. Do not poll for one.
* Do not verify one as part of finishing a task.
* Do not push an empty commit, or re-push, to make one happen.
* Do not report a missing deployment as a failure of the merge — it is not one.

A deployment is a **separate, explicit step**: a human does it, or a human asks for it by name.

### Why, measured

On 2026-09-12, deploying on every sub-issue pushed the account into Vercel's build rate limit. The
symptom is not a refusal that names itself: a push simply produces no deployment, the previous build
keeps serving, and the project looks identical to one with a broken git connection, a wrong
production branch, an ignored-build-step polarity bug, or a stuck project. Four such causes were
investigated and committed before the real one was found — a working day spent on deployments that
were the *consequence* of deploying too often, and four wrong diagnoses in the history.

So the rule is not "deploy less often". It is that **the loop does not contain a deployment at all**,
because a step that can neither be observed from inside the repository nor fixed from inside it does
not belong in a loop that runs on its own.

Corollary for verification: the checks in this repository prove a change is *correct*, not that it is
*public*. `tools/verify-live.sh` and `tools/verify-deployments.sh` read what is already deployed.
They are health checks to run when asked, not a finishing step — and when a deployment is behind,
they will fail, correctly, for a reason that is not a defect in the change.

### The one place a deployment is load-bearing

The landing page's `scripts/verify.sh` fetches **every anchor a `live` card publishes**, so a card
flipped to `live` before its deployment answers `200` fails the gate. That is deliberate — a card
linking to a login wall or a 404 is worse than no card — and it is not a deployment step in disguise.

The consequence is a rule about *ordering*, not about waiting: flip a card in the issue that finishes
that app's deployment, once a human has deployed it. Until then the card stays `in-development`, and
the gate is satisfied without anyone watching a build.

---

## 13. Which model runs a worker

`tools/worker-run.sh` runs one Cursor CLI pass against a frozen brief. The owner's standing model
preference, and the only three ids it will accept:

| Model | Use it for |
| --- | --- |
| `auto` | the default, for ordinary work |
| `composer-2.5-fast` | where it fits: routine, well-specified changes |
| `cursor-grok-4.6-high` | hard work — anything needing judgement, not just execution |

The owner writes the third as `cursor-grok-4.6`; there is no bare id, and `-high` is the unqualified
variant, so the harness resolves the shorthand rather than refusing it as unknown.

**Anything else is refused.** `WORKER_ALLOW_ANY_MODEL=1` overrides that, and the harness prints a
warning when it does. The refusal is deliberately not "no Anthropic models": this harness once spent
three tickets on an expensive default before anyone noticed, and a rule that banned one vendor would
not have stopped the next one arriving the same way.

Two things to know when choosing. `auto` is Cursor's own router, and a run's real model is not
visible from the harness, so when cost matters for a particular run, name one of the other two
instead of leaving it to the router. And a brief that needs judgement is worth the slower model: the
same task run on a fast model can pass every command it was asked to run and still miss the thing the
issue was about.

This policy lives here as well as in the harness's own comments, because a rule that only exists in
the source of the tool that enforces it is not discoverable by the agent deciding which model to ask
for.


