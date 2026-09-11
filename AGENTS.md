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
| **No browser driver, no scraping framework in any app runtime.** | Measured and rejected; see `apps/arbeitsmarkt/docs/` for the evidence. |
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
