# Reviewer brief — GOC-35, the monorepo is the only copy and it is fit to publish

You are the **reviewer**. You did not write this work and you are not being told why it was done the
way it was. Your job is to judge whether the tree satisfies the frozen requirement, and to find what
is wrong with it.

**Change nothing.** Do not edit, do not create, do not delete, do not commit, do not stage. You are
reading and running things. A reviewer that fixes what it finds destroys the evidence.

Read `AGENTS.md` first — §2 (public bar), §4 (non-negotiables), §6 (a guard must be seen to fail) and
§7 (never trust a report; verify by running).

## What is under review

The changes from `dca545f` to the current working tree. Get the diff and the file list:

```bash
git log --oneline dca545f..HEAD
git diff --stat dca545f..HEAD
git diff dca545f..HEAD
git status --porcelain          # anything uncommitted is also under review
```

## The frozen requirement

Five Linear issues. This is the requirement, verbatim, and it is the only standard you judge against.

### GOC-36 — Archive the source repositories once every application lives here

1. For each source repository: confirm its application exists here and passes this repository's
   gate, and that the monorepo has the material the app needs.
2. Archive it. Do not delete: its history may be wanted later.
3. Confirm no repository document points at it afterwards.

- **A-1** Every application from a source repository builds and verifies in this monorepo.
- **A-2** Each source repository is archived, with the state observed.
- **A-3** A search of this repository for each source repository's name returns no reference outside
  of the decision note.
- **Human step** — Archiving is done in the hosting UI.

### GOC-37 — Confirm exactly one repository is public

1. List every repository in the organisation with its visibility.
2. Confirm exactly one is public, and that it is this one.
3. Record the observed list and the date.

- **A-1** The observed visibility of every repository is recorded on this issue with a timestamp.
- **A-2** Any repository that is public but should not be is reported rather than silently changed.
- **Risks** — Changing another repository's visibility is not this ticket's call. Report, do not act.

### GOC-38 — Publish the legal and terms-of-service position

1. Code licence present and correct at the root, and every application declares the same licence in
   its manifest.
2. Dependency licences: every direct dependency's licence is compatible with redistributing this
   repository publicly. Record the check and any that needed attention.
3. Vendored content: any data, font, image or text that came from elsewhere has a stated origin and
   a licence permitting redistribution — or is removed.
4. Terms of service: where a project interacts with a third-party service, the repository states
   what the service's terms allow and what this project does inside that boundary. The job-listings
   pipeline is the one that matters; its compliance rules must be described here, not only in its
   own documents.
5. The statement lives in the repository and is linked from the root `README.md`.

- **A-1** A licence file is present and the root `README.md` links to the position document.
- **A-2** Every direct dependency's licence is listed with its compatibility conclusion.
- **A-3** Every vendored item has an origin and a redistribution-permitting licence, or is gone.
- **A-4** The document states, for the job-listings pipeline, which sources are permitted and which
  are disabled, and why.
- **Stop and ask** — If any dependency's licence, or any dataset's terms, is unclear or incompatible,
  do not publish. Report it and propose a replacement.

### GOC-39 — Audit every published claim for provenance

1. Every number published anywhere in the repository — the landing page, any application view, any
   document — is traced to the command that produced it and the date it was produced.
2. Any number that cannot be traced is removed, or replaced by one that can.
3. The audit lists every claim, its source, and its date, and is committed so the next reader can
   re-run the check.

- **A-1** A committed document lists every published claim with its reproducing command and date.
- **A-2** Re-running the listed commands reproduces the published numbers, or the claim is flagged
  and removed.
- **A-3** No published number is left without an entry.
- **Notes** — If a claim cannot be reproduced, that is a finding, not a documentation problem. Remove
  the claim and say so.

### GOC-40 — Audit every published link

1. Every external link published anywhere in the repository — documents included — is fetched and its
   status recorded.
2. Any link that does not resolve is removed or corrected.
3. Confirm every card marked `live` still resolves, and every card marked `in-development` renders no
   link.
4. Commit the audit, so a later reader can re-run it.

- **A-1** Every external link in every tracked document returns a success status, or has been removed.
- **A-2** The audit document lists each URL, its status, and the date it was checked.
- **A-3** `bash scripts/verify.sh` exits 0, so the card rule holds as well.

## How to judge — and the specific ways this work could be wrong

Run things. A report is a claim about the author's intent; the tree is the artefact.

1. **Judge each acceptance criterion separately.** For each one, either paste the exact command you
   ran and its output showing it is met, or say it is not met, or say why you could not verify it.
   "Looks right" is not a finding.

2. **Hunt for fabricated content.** These deliverables are mostly prose about facts. Every licence
   identifier, copyright line, version number, URL, status and count in the new documents is a
   checkable claim. Spot-check them against the tree, and against the upstream sources where the
   document cites one. A plausible-looking invented citation is the most likely serious defect here.

3. **Hunt for silent no-ops.** A check that reports success while scanning nothing looks identical to
   a check that works. For every new guard or `--check` mode: prove it fails. Add a temporary probe
   **outside the repository** (write to `var/` or `/tmp`, never to a tracked path) or use the tool's
   own fixture flags, show the failure, and paste it. If a guard cannot be made to fail, say so —
   that is a finding, not a pass.

4. **Check the environment the check will actually run in.** The gate runs on a fresh CI checkout,
   where **nothing is installed** — no `node_modules`, no build output. Ask of every new check: does
   it work there? A clean `git worktree` at `HEAD` is a good approximation:

   ```bash
   W=$(mktemp -d) && git worktree add -q --detach "$W" HEAD && (cd "$W" && <command>) ; git worktree remove --force "$W"
   ```

   Note that untracked and unstaged files do not travel into a worktree; copy them in if you need to
   test uncommitted work.

5. **Check for claims that contradict the tree.** Specifically: does `docs/LEGAL.md` name a source as
   permitted or disabled in a way that disagrees with `apps/arbeitsmarkt/data/sources.json`? Does the
   dependency table agree with a fresh `node tools/audit-licences.mjs --list`? Do the counts in
   `docs/CLAIM_AUDIT.md` agree with a real run of the commands it lists?

6. **Check the things a document can quietly get wrong.** Broken relative links in changed markdown.
   A link to a file that does not exist. A number in prose that no longer matches the code. A claim
   about a guard that the guard's own source contradicts.

7. **Consider what is missing, not only what is present.** GOC-38 requires every vendored item to
   have a stated origin. GOC-39 requires **no** published number to be left without an entry — so
   find a published number the audit does not list, if there is one. GOC-40 requires **every**
   external link in **every** tracked document — so find one it missed.

## Output

A verdict, in this order:

1. **Per acceptance criterion**, for all five issues: met / not met / not verifiable, each with the
   command you ran and the output you saw.
2. **Defects**, most serious first. For each: what is wrong, where, the evidence, and whether it
   blocks the requirement or is a lesser finding. Say plainly if you believe a document contains a
   fabricated fact.
3. **What you could not check**, and why.
4. **A blunt overall judgement**: does this satisfy GOC-35, or not? If not, what is missing?

Do not soften a finding to be agreeable, and do not invent a finding to look thorough. If the work is
sound, say so and show why.
