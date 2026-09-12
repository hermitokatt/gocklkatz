# AGENT.md

Guidance for agents working in this repository.

## Purpose

This repository builds **Simplified** — an application for learning and practicing simplified Chinese characters (汉字).

## Product plan

| Doc                                                | Role                                                      |
| -------------------------------------------------- | --------------------------------------------------------- |
| [`docs/MVP.md`](docs/MVP.md)                       | MVP charter (stack, radicals-first feature, out of scope) |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)               | Ticket-generation SoT (Done / Next slices)                |
| [`docs/hanzi_research.md`](docs/hanzi_research.md) | Learning-research background                              |

**Stack pin:** Next.js App Router, React 19, TypeScript, Zod Route Handlers, Vitest, Vercel — rewrite habits from [software-factory-demo](https://cursor.com/codebase/gocklkatz/software-factory-demo); do not copy that repo’s product code.

MVP first feature: **Learning radicals and common components** (see `docs/MVP.md`).

## Research

Background research on effective hanzi learning practices lives in [`docs/hanzi_research.md`](docs/hanzi_research.md). It covers structure-first learning (radicals/components), frequency/HSK ordering, mnemonics, stroke order, spaced repetition, and product implications. Prefer that document over rediscovering the same ground unless new questions arise.

## Workflow (Linear)

Work is driven by **Linear issues** in this project:

- Project: Simplified
- Team: STE

When starting or continuing work:

1. Find the relevant Linear issue (Humans create issues from [`docs/ROADMAP.md`](docs/ROADMAP.md); Bots do not create Linear issues).
2. Set the issue **In Progress**, implement against its scope, and keep discussion on the issue.
3. Open a **draft** PR that references the ticket (`Fixes STE-XX`). Do not merge; Human merge is approval.
4. If blocked, comment on Linear and stop. Do not invent scope or a second ticket tracker beyond ROADMAP as draft SoT.
