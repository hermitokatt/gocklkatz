# Simplified

An application for learning and practicing simplified Chinese characters (汉字).

## Production

Production URL: **<https://gocklkatz-simplified.vercel.app>** — fetched anonymously and answering `200`.

Deploy steps: [`docs/DEPLOY.md`](docs/DEPLOY.md). Smoke: `/`, `/api/health`, `/learn/radicals`, `/learn/radicals/practice`. The app deploys from the monorepo's Vercel project of the same name, whose Root Directory is `apps/simplified`; a merge to `main` is what deploys it.

## MVP

First ship: a website (frontend + backend) for **learning radicals and common components**. Charter and phases: [`docs/MVP.md`](docs/MVP.md). Implementation slices: [`docs/ROADMAP.md`](docs/ROADMAP.md). Research notes: [`docs/hanzi_research.md`](docs/hanzi_research.md).

**Stack:** Next.js App Router 16.x, React 19, TypeScript (strict), Zod Route Handlers, Vitest, Vercel — written for this project. CSS-first UI (no Tailwind in Phase 0). Allowed packages: [`docs/DEPENDENCY_ALLOWLIST.md`](docs/DEPENDENCY_ALLOWLIST.md).

## Data provenance

The app ships one dataset: the radical and component set in [`lib/radicals/seed.ts`](lib/radicals/seed.ts) — 45 components, each with its forms, a Mandarin reading, an English gloss, a note on how the form varies, three example characters, and a teaching order. There is no other data file, and nothing is fetched at runtime.

**Where it came from.** The record here is a description, not a claim of original authorship over the language itself, so it separates two things that carry different rights.

_What is not owned by anyone._ Which components exist, how they are written, how they are pronounced, and what they mean are facts about the writing system, in the public domain and identical in every reference work. The readings are standard Hanyu Pinyin using tone marks, not a transcription of any particular dictionary. The example characters are ordinary high-frequency characters built from the component — 休 for 人, 河 for 氵 — and the pairing is what any textbook would give.

_What was written for this project._ The selection and ordering of the 45 components (stated as pedagogical rather than Kangxi index order in the seed's own header), the English glosses and their wording, the `variantsNote` explanations, and the choice of examples. The glosses average 18 characters and are paraphrases rather than copies; 月 is given as "moon; month; often flesh/body in compounds", which is a teaching note, not a dictionary entry.

**No third-party dataset.** Nothing here derives from CC-CEDICT, Unihan, Wiktionary, or any other licensed corpus, and no dictionary was transcribed. The research notes in [`docs/hanzi_research.md`](docs/hanzi_research.md) were gathered from public web pages in September 2026 and cite each source inline; they informed what the app teaches, and no character data was taken from them.

**Retrieval date.** The dataset was written for this project and last reviewed in September 2026. It is maintained by editing `lib/radicals/seed.ts`; `tests/radicals.test.ts` fails if an entry breaks the schema.

**Licence.** The repository is MIT (see [`LICENSE`](../../LICENSE)), which covers this dataset with the rest of the source.

**If you extend it.** Add components from your own knowledge of the writing system rather than pasting a published radical list, and keep the gloss in your own words. A dataset copied from a source whose licence is unclear cannot ship here.

## Run locally

Requires **Node 22+**.

```bash
npm install
npm run dev
```

Then open **[http://localhost:3000](http://localhost:3000)** (home) and [http://localhost:3000/api/health](http://localhost:3000/api/health).

`next dev` also prints a **Network** URL (`http://10.x.x.x:3000`). Prefer localhost. Reaching that address from another device needs the host allowlisted for HMR, which this app does not do by default; add it to `allowedDevOrigins` in `next.config.ts` if you want it. Nothing in production depends on this — the setting only affects the development server.

To run without the dev/HMR server (production mode):

```bash
npm run build && npm run start
```

### Quality gate

```bash
bash scripts/ci.sh
```

Runs lint, typecheck, Vitest, and production build.

| Script              | Purpose                   |
| ------------------- | ------------------------- |
| `npm run dev`       | Local Next.js server      |
| `npm run lint`      | ESLint                    |
| `npm run typecheck` | `tsc --noEmit`            |
| `npm run test`      | Vitest                    |
| `npm run build`     | Production build          |
| `npm run ci`        | Full `scripts/ci.sh` gate |

## Agents

See [`AGENTS.md`](AGENTS.md) for this app's contract, and the repository's
[`AGENTS.md`](../../AGENTS.md) for the standing rules that govern it.
