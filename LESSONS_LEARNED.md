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

* **The 2026-09-12 entry** was written during the GOC-23 work and every figure in it was re-measured
  before it was written down: the 30–50 schema range, the 45 seed entries, `*.tsbuildinfo` and
  `next-env.d.ts` being gitignored, the 40 tracked files in `apps/simplified`, the `302` from the
  project alias, and the four merge commits `6cc4fae`, `4973934`, `345173c`, `24f9f0d`.
* **The 22,319 files / 536 MB figure** for the second `node_modules` copy was measured directly.
* **The 24,047 files / 601 MB figure** for the earlier Ameisenwerkstatt copy comes from an earlier
  session and was **not** re-verified when this entry was written. Treat it as reported, not
  confirmed, and re-measure it if it ever matters.
* Anything added later should say how it was measured, or say that it was not.
