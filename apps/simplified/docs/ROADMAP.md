# Simplified plan

What this application is, what it has, and what is deliberately parked. The product charter is
[`MVP.md`](./MVP.md); the research behind the feature is [`hanzi_research.md`](./hanzi_research.md).

**Work is tracked in Linear** — project **Portfolio**, team **GOC** — and the delivery loop for
changes in this repository is the one in [`AGENTS.md`](../../../AGENTS.md) §11 and §12. This file is
a plan, not a ticket ledger: it does not define work items and nothing here should be read as an
agenda for one.

## Shipped

| Area            | What is in the app                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Harness         | Next.js App Router, TypeScript strict, Zod on every wire shape, Vitest, ESLint, Prettier, `scripts/ci.sh` |
| Radicals domain | Curated seed, Zod schemas, pure helpers — `lib/radicals/`                                                 |
| API             | `GET /api/radicals`, `GET /api/radicals/[id]`, `GET /api/health`                                          |
| Study UI        | `/learn/radicals` list and `/learn/radicals/[id]` detail                                                  |
| Practice        | `/learn/radicals/practice`, client-local progress in `localStorage`                                       |
| Deployment      | Vercel, on its own project and custom domain — see [`docs/DEPLOY.md`](../../../docs/DEPLOY.md)            |

## Parked — post-MVP

| Item                         | Note                                                  |
| ---------------------------- | ----------------------------------------------------- |
| Frequency/HSK character path | Component-gated unlocks, after the radicals bootstrap |
| Spaced-repetition engine     | Its own queues; soft caps on new cards                |
| Words and graded reading     | Context after form, meaning and sound                 |
| Stroke writing               | A separate production skill; not recognition          |
| Mnemonics                    | Only if user research asks for them                   |
| Auth, database, AI SDK       | Only with a ticket and an allowlist update            |

## Out of scope — do not pull into the MVP

- A second ticket database outside Linear.
- A full literacy curriculum before the radicals bootstrap.
- Accounts, cloud sync, or any server-side learner data. Practice progress is browser-local by
  design, not by omission.
- Traditional characters as a first-class track.
- Copying another application's product surfaces.

## Gates

```bash
npm ci
npm run dev             # http://127.0.0.1:43125
bash scripts/ci.sh
bash scripts/verify.sh
```

This app binds port **43125**.
