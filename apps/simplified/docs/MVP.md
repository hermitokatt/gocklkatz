# Simplified MVP charter

Product charter for the first shippable slice of **Simplified** — a website for learning simplified Chinese characters (汉字). Research SoT: [`hanzi_research.md`](./hanzi_research.md). Ticket-generation SoT: [`ROADMAP.md`](./ROADMAP.md). Parent ticket: Linear **STE-72** (SIM-001).

Tech stack reference (rewrite, do not copy files): [software-factory-demo](https://cursor.com/codebase/gocklkatz/software-factory-demo).

## Vision

A learner opens a public site, browses the most common **radicals and graphic components**, studies each one’s form, meaning, and shape-shift variants (e.g. 人 → 亻), sees a few example characters that use it, then runs a short **recognition practice**. That is the MVP product surface. Full character curriculum, SRS, and words come later.

Research basis: structure-first learning — common components early (~30–50), not rote whole-character dumps ([`hanzi_research.md`](./hanzi_research.md) §§1–2, §4, §10).

## MVP definition of done

A deployed (or locally runnable) **frontend + backend** website where a visitor can:

1. Open a branded home page.
2. Browse a curated set of ~30–50 high-frequency meaning components / radicals.
3. Open a component detail: glyph(s), English gloss, variants, short notes, example characters.
4. Practice recognition (glyph → meaning and/or meaning → glyph) with progressive disclosure (study aids on, quiz aids off).
5. Keep practice progress **client-local** for MVP (no accounts).

Proof: health API green, Vitest covering domain/API schemas, `bash scripts/ci.sh` green once the harness exists, and a human can click through study + one practice round.

## Stack (locked)

| Lock | Value |
| --- | --- |
| Runtime | Node **22+** |
| App | **Next.js** App Router (**16.x** family), **React 19**, **TypeScript** strict |
| Backend | Zod-validated **Route Handlers** under `app/api/**` (not Server Actions for MVP) |
| Domain | Pure modules under `lib/<feature>/` |
| UI | CSS-first (globals + CSS modules); no Tailwind/shadcn unless a later STE + allowlist says so |
| Tests | **Vitest** under `tests/`; quality gate `bash scripts/ci.sh` (lint, typecheck, test, build) |
| Deploy | **Vercel** (SIM-006); public after merge |
| Explicitly not in MVP | Auth, database/ORM, AI SDK, Playwright, full SRS engine |

Pack-review: habits from software-factory-demo may be **rewritten** for this repo. Do not paste demo product code (`/ameisen`, DualAB, three.js) into Simplified.

## Phases

```
Phase 0 Harness  →  Phase 1 Radicals (MVP feature)  →  Post-MVP (characters, SRS, words)
```

| Phase | What | Outcome |
| --- | --- | --- |
| **0 — Harness** | Next app shell, Zod `GET /api/health`, Vitest, ESLint/Prettier, `scripts/ci.sh`, dependency allowlist, branded `/` | CI-ready empty product |
| **1 — Radicals** | Domain + seed + API + study UI + recognition practice | First learning feature live |
| **Post-MVP** | Frequency/HSK characters with component prerequisites, SRS queues, words/context, stroke practice, mnemonics | Literacy path beyond bootstrap |

## First feature: Learning radicals and common components

### User flows

1. **Browse** — `/learn/radicals` lists components (glyph + short gloss). Sort/filter optional; default order = pedagogical frequency within the seed set.
2. **Study** — `/learn/radicals/[id]` shows primary form, variants, gloss, optional pinyin name of the radical, “appears in” example characters (illustrative only — not a full character curriculum), and optional short teaching note.
3. **Practice** — `/learn/radicals/practice` (or equivalent) presents recognition items. Correct/incorrect feedback; session summary. Aids hidden during the question; available after answer or in study mode.
4. **Home** — `/` explains Simplified in one breath and links into Learn radicals.

### Data model (sketch)

Zod schemas in `lib/radicals/`; seed JSON or TS fixtures shipped with the repo.

| Field | Purpose |
| --- | --- |
| `id` | Stable slug (e.g. `water`, `person`) |
| `forms` | One or more glyphs (standalone + combining variants) |
| `gloss` | Short English meaning / category hint |
| `pinyin` | Optional conventional name reading |
| `variantsNote` | How forms relate (人 / 亻) |
| `examples` | Small list of `{ char, pinyin?, gloss }` using the component |
| `order` | Display / curriculum rank within the MVP seed |

Seed size: **~30–50** most useful meaning components for beginners (not all 200+ traditional radicals). Prefer functional components over deep etymology when they conflict ([`hanzi_research.md`](./hanzi_research.md) §1).

### API (Phase 1)

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/api/health` | Harness liveness (Phase 0) |
| `GET` | `/api/radicals` | List seed components (Zod response) |
| `GET` | `/api/radicals/[id]` | One component by id; 404 if missing |

Invalid input → 400; unknown id → 404. No writes in MVP.

### UI / pedagogy notes

- Mainland-simplified–appropriate fonts (called out when harness/allowlist lands).
- Show component breakdown and variants during **study**; hide flashy overlays during **recall** ([`hanzi_research.md`](./hanzi_research.md) §6).
- Example characters illustrate the radical; they are not unlockable curriculum cards yet.
- Cap practice session length so the queue stays light (soft session size, not full SRS).

## Layout (target after harness)

```
app/                 # App Router UI + api/
  learn/radicals/    # study + practice
  api/health/
  api/radicals/
lib/radicals/        # schemas, seed, pure helpers
tests/               # Vitest
docs/                # research, MVP, ROADMAP
scripts/ci.sh
```

## Out of scope (this MVP)

- Full HSK / frequency character path and component-gated unlocks
- Spaced-repetition engine (Anki-style scheduling)
- Stroke-order writing canvas / handwriting recognition
- User accounts, cloud sync, database
- Mnemonics marketplace / community defaults
- Graded reading passages
- Traditional characters as a first-class track
- AI chat tutors / AI SDK
- Copying software-factory-demo product surfaces

## Related

- Research: [`hanzi_research.md`](./hanzi_research.md)
- Roadmap / next STEs: [`ROADMAP.md`](./ROADMAP.md)
- Agent workflow: [`../AGENT.md`](../AGENT.md)
- Stack golden path: [software-factory-demo](https://cursor.com/codebase/gocklkatz/software-factory-demo)
