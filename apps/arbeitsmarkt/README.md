# Arbeitsmarkt

Portfolio demo of a job-listing pipeline. The shipped surface uses a **synthetic** dataset
generated from a checked-in seed. No live listings are acquired, committed, or published.

## Surface

| Route           | Notes                                                      |
| --------------- | ---------------------------------------------------------- |
| `/`             | App card                                                   |
| `/arbeitsmarkt` | Exhibit: synthetic statement, sample listings, name legend |
| `/api/health`   | `{ "ok": true, "service": "arbeitsmarkt" }`                |

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
dataset shape. See [`docs/ACQUISITION.md`](./docs/ACQUISITION.md) for why browser drivers and
scraping frameworks are absent from this app.

Regenerate the committed file after changing the generator:

```bash
node scripts/write-dataset.mjs
```

Then run `npm test` — the committed-output equality test must stay green.

## Deploy

Creating the Vercel project and attaching a domain is not part of this work. The demo is not
claimed live from this tree alone.
