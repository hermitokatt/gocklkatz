# Arbeitsmarkt

Portfolio demo of a job-listing pipeline. The shipped surface uses a **synthetic** dataset
generated from a checked-in seed. No live listings are acquired, committed, or published.

## Surface

| Route                      | Notes                                                         |
| -------------------------- | ------------------------------------------------------------- |
| `/`                        | App card                                                      |
| `/arbeitsmarkt`            | Exhibit: synthetic statement, sample listings, name legend    |
| `/arbeitsmarkt/digest`     | Ranked digest over the synthetic set (filter → rank → digest) |
| `/arbeitsmarkt/operations` | Source health, budgets, alarms (demonstration failure policy) |
| `/api/health`              | `{ "ok": true, "service": "arbeitsmarkt" }`                   |

## Run

```bash
npm ci
npm run dev          # http://127.0.0.1:43127
bash scripts/ci.sh
bash scripts/verify.sh
```

Port **43127**. Ameisenwerkstatt 43123, landing 43124, Simplified 43125, Bienenstock 43126.

## Data

See [`docs/SYNTHETIC_DATA.md`](./docs/SYNTHETIC_DATA.md) for the seed, naming construction, and
dataset shape. See [`docs/RANKING.md`](./docs/RANKING.md) for the demonstration profile, filter
rules, and scoring weights. See [`docs/OPERATIONS.md`](./docs/OPERATIONS.md) for source health,
budgets, and the demonstration failure policy. See [`docs/ACQUISITION.md`](./docs/ACQUISITION.md)
for why browser drivers and scraping frameworks are absent from this app.

Regenerate the committed file after changing the generator:

```bash
node scripts/write-dataset.mjs
```

Then run `npm test` — the committed-output equality test must stay green.

## Deploy

Production URL: **<https://gocklkatz-arbeitsmarkt.vercel.app>** — fetched anonymously and answering
`200` on `/`, `/arbeitsmarkt`, `/arbeitsmarkt/digest` and `/arbeitsmarkt/operations`.

The app deploys from the monorepo's Vercel project of the same name, whose Root Directory is
`apps/arbeitsmarkt`; a merge to `main` is what deploys it. The published views each carry the
synthetic-data statement, verified by fetching them.
