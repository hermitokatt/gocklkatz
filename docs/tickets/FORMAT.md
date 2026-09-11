# Ticket format

A ticket is the **frozen requirement**. It is written before implementation and does not change
afterwards — if the requirement was wrong, that is a new ticket, not an edit.

One file per ticket: `docs/tickets/NNN-short-slug.md`.

---

## Sections (all required)

### `# NNN — Title`

Imperative and specific. It becomes the commit subject, so it must read as a professional
commit message: `Add dependency allowlist enforcement gate`.

### `## Plain English`

Three to six sentences. What is wanted and why, in language a non-engineer can follow. If this
section cannot be written plainly, the requirement is not yet understood.

### `## Requirement`

The precise behaviour, as a numbered list. Each item is observable from outside the code.

### `## Acceptance criteria`

**Executable commands, not prose.** Each criterion is a command that exits non-zero when the
requirement is unmet, plus the assertion it proves. A criterion nobody can run is not a
criterion — rewrite it until it is.

```bash
# A-1  the gate fails when a dependency is undeclared
npx vitest run tests/deps.test.ts   # exits 0 only when the guard passes AND fails its fixture
```

Every guard names **the thing that makes it fail**. A guard that has never been seen to fail is
not a guard (AGENTS.md §6).

### `## Out of scope`

The adjacent things a reasonable implementer might also do. This list exists so that scope
creep is visible, not so that it is silently absorbed.

### `## Risks / notes`

Anything known to be fragile or surprising. Cite the evidence that makes it so.

---

## Rules

1. **Frozen before work starts.** The worker reads it; the worker does not edit it.
2. **Every acceptance criterion is a command with an expected exit code or output.**
3. **Evidence, not assertion.** "Tests pass" is not a criterion. `npx vitest run X` exiting 0 is.
4. **State what was not verified.** The report ends with the honest gaps.
5. **No criterion may depend on the worker's own summary.**
