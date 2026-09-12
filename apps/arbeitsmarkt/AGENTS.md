# AGENTS.md — Arbeitsmarkt

The standing contract for this repository is [`AGENTS.md`](../../AGENTS.md) at the root. It governs.
This file adds only what is specific to this application.

## What this app is

A Next.js App Router application: TypeScript strict, Zod on the health wire shape and the
synthetic dataset, Vitest, ESLint, Prettier. Self-contained — own `package.json`, lockfile, and
gates. It does not import from the landing page or any other app.

## Surface

| Route                      | Method | Notes                                                        |
| -------------------------- | ------ | ------------------------------------------------------------ |
| `/`                        | GET    | App card                                                     |
| `/arbeitsmarkt`            | GET    | Exhibit; states that data is synthetic; sample + legend      |
| `/arbeitsmarkt/digest`     | GET    | Ranked digest; filter rejections; pipeline stage counts      |
| `/arbeitsmarkt/operations` | GET    | Source health, budgets, alarms; demonstration failure policy |
| `/api/health`              | GET    | `{ "ok": true, "service": "arbeitsmarkt" }`                  |

## Rules that are easy to break here

- **No acquisition path.** Do not add `fetch` to listing hosts, a scraping framework, or a
  browser driver. Do not add a “live with synthetic fallback” branch.
- **Generator is pure.** Every module under `lib/dataset/` uses `createRng` only. No `Math.random`,
  no `Date.now`, no `new Date()` with no argument, no `performance.now`, no `process.env`. Posting
  dates come from a fixed window recorded in the dataset. `new Date(ms)` from a fixed timestamp is
  fine — it is the no-argument form that reads the clock.
- **Pipeline is pure.** Every module under `lib/pipeline/` reads no clock and no environment. Ranking
  is deterministic given the committed dataset and `data/profile.json`. Operational snapshots are
  deterministic given `data/sources.json` and the dataset.
- **Operations model misbehaviour from committed records only.** Do not add a live probe, a
  “try the source” branch, or any acquisition path when extending the operations view.
- **Synthetic flags are structural.** Dataset `meta.synthetic` and every record's `synthetic:
true` must remain meaningful — the synthetic-only filter test must keep returning every record.
- **Committed output matches the generator.** Editing `data/listings.json` by hand without
  regenerating from the seed fails the equality test on purpose.

## Gates

```bash
npm ci
npm run dev             # http://127.0.0.1:43127
bash scripts/ci.sh
bash scripts/verify.sh
```

This app binds port **43127**.
