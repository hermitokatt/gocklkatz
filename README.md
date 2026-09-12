# gocklkatz

**Gocklkatz Inc** — engineering portfolio and demo works.

One monorepo: a landing page and four independent demo applications. Each application is
self-contained — its own `package.json`, its own lockfile, its own test suite — so that one
demo's dependency or build breakage cannot take down another's.

## Applications

| Path | Demo | What it is |
| --- | --- | --- |
| *(root)* | Landing page | The portfolio home. One card per demo; a card links to its deployment only once that deployment is live. |
| `apps/ameisenwerkstatt` | [Ameisenwerkstatt](https://gocklkatz-ameisenwerkstatt.vercel.app) | Ant colony optimization on a fixed TSP, with a live 3D workspace. |
| `apps/bienenstock` | [Bienenstock](https://gocklkatz-bienenstock.vercel.app) | Bee colony simulation — hive and foraging, rendered in 3D. |
| `apps/simplified` | [Simplified](https://gocklkatz-simplified.vercel.app) | Learning and practising simplified Chinese characters (汉字). |
| `apps/arbeitsmarkt` | [Arbeitsmarkt](https://gocklkatz-arbeitsmarkt.vercel.app) | A relevance-ranked job-listing pipeline, demonstrated on synthetic data. |

Source of truth for code: <https://cursor.com/codebase/gocklkatz/gocklkatz>.
This repository is public — read [`AGENTS.md`](./AGENTS.md) before contributing.

## Deploy

Each application is a separate Vercel project pointing at its own root directory, so a demo can be
built, shared and rolled back on its own.

| Vercel project | Root Directory | Live URL |
| --- | --- | --- |
| `gocklkatz` | `.` | <https://gocklkatz.vercel.app> |
| `gocklkatz-ameisenwerkstatt` | `apps/ameisenwerkstatt` | <https://gocklkatz-ameisenwerkstatt.vercel.app> |
| `gocklkatz-bienenstock` | `apps/bienenstock` | <https://gocklkatz-bienenstock.vercel.app> |
| `gocklkatz-simplified` | `apps/simplified` | <https://gocklkatz-simplified.vercel.app> |
| `gocklkatz-arbeitsmarkt` | `apps/arbeitsmarkt` | <https://gocklkatz-arbeitsmarkt.vercel.app> |

A URL is recorded here only once it has been fetched and returned `200`. Details, the CI gate and
the shared quality bar: [`docs/DEPLOY.md`](./docs/DEPLOY.md). Legal and terms-of-service position:
[`docs/LEGAL.md`](./docs/LEGAL.md).

## Working on this repository

```bash
bash tools/gate.sh          # content guard, identity, hygiene, every app, all self-tests
```

The gate is bound to the git tree and enforced again on push. See [`AGENTS.md`](./AGENTS.md).

The delivery loop is `branch → gate → PR → Gate green → local merge --no-ff → push main → mirror to
GitHub`, and it **ends there**. Deploying is a separate, explicit step a human runs or asks for; the
loop never waits on one (`AGENTS.md` §12, and why, in [`docs/DEPLOY.md`](./docs/DEPLOY.md)).

### The landing page

The root of this repository is the landing page application. Its own gates:

```bash
npm ci                      # once, from the lockfile
npm run dev                 # http://127.0.0.1:43124
bash scripts/ci.sh          # format, lint, typecheck, tests, build
bash scripts/verify.sh      # builds it, serves it, fetches every route and every link
```

`scripts/verify.sh` is the one that can tell you the page is *wrong*: it asserts that a card marked
`live` links to a URL that answers `200`, and that a card marked `in-development` renders no link
at all. It needs outbound network access, because it fetches the links the page publishes.

## License

MIT — see [`LICENSE`](./LICENSE). Copyright (c) 2026 Gocklkatz Inc.
