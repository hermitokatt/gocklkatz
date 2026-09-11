# Reviewer brief — ticket 001 (landing page)

You are the **independent reviewer**. You did not write this code and you are not being asked to
agree with anyone. Another agent implemented it against a frozen ticket, and the orchestrator has
already run the acceptance criteria once. Both may be wrong. Your job is to find out.

## What to read

1. `docs/tickets/001-landing-page.md` — the requirement and its acceptance criteria.
2. `AGENTS.md` — the standing contract, especially sections 6 and 7.
3. The uncommitted working tree. The landing page is at the repository root:
   `app/`, `src/`, `scripts/`, plus `package.json`, `next.config.ts`, `vitest.config.ts`,
   `eslint.config.mjs`, `tsconfig.json`, and the edits to `README.md`, `docs/DEPLOY.md` and
   `repo.config`.

## Your task

**Verify by running, not by reading.** A report is a claim about the author's intent; the tree is
the artefact. Specifically:

1. **Run the acceptance criteria yourself** — A-1 to A-6 in the ticket. Report what you observed,
   not what the ticket says should happen. For A-5 you must temporarily set a card to `live` with
   an unresolvable URL, show `scripts/verify.sh` failing, and revert.

2. **Attack the link rule.** It is the heart of this ticket: a card whose status is `live` must
   link somewhere that resolves, and a card whose status is `in-development` must render **no
   anchor at all**. Try to defeat it:
   - What happens with a `live` card whose URL returns a redirect, a 403, or a 500?
   - Can a card render an anchor while still being `in-development`?
   - Does the check actually read the *served* HTML, or does it trust the source data?
   - Is the card's URL list the only source of links on the page? If a link is added elsewhere,
     is it checked?

3. **Where could this pass while doing nothing?** This repository has repeatedly been burned by
   checks that reported success without running. The verify script depends on `data-demo` and
   `data-status` attributes in the served markup — what happens if those attributes disappear? Does
   the probe fail loudly, or pass having found no cards?

4. **Does `scripts/ci.sh` and `scripts/verify.sh` behave correctly on a clean checkout?** They
   install dependencies themselves because CI runs with no install step. Check the logic for a
   missing `node_modules`, a failed install, a port already in use, and a server that dies during
   startup.

5. **Anything else you would refuse to merge.** Be specific and cite the file and line.

## Rules

* **Do not modify the repository.** Read, run, and report. If you must create a file to test, put
  it in `var/` (gitignored) and delete it afterwards. Leave the tree exactly as you found it —
  except for the A-5 temporary change, which you must revert.
* **Do not commit.**
* Node 22 semantics (CI runs Node 22; this machine runs a newer Node).
* The page is served on port 43124. Ameisenwerkstatt owns 43123.
* Be adversarial but precise. "This looks fine" is not a finding. A finding names a file, a command,
  and an observed result.

## Report

* Findings first, most serious first. For each: what you ran, what you saw, why it matters, and how
  a fix would change behaviour.
* Then what you verified and could not break.
* Then **what you did not verify** — be explicit about the limits of your review.
