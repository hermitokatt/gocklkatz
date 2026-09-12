# AGENTS.md — Simplified

The standing contract for this repository is [`AGENTS.md`](../../AGENTS.md) at the root. It governs.
This file adds only what is specific to this application; where the two ever disagree, the root file
wins and this one is the defect.

## What this app is

A Next.js App Router application: TypeScript strict, Zod on every wire shape and on the seed data,
Vitest, ESLint, Prettier. Self-contained — own `package.json`, own lockfile, own gates. It does not
import from the landing page or from any other app.

Product background, in reading order:

1. [`docs/MVP.md`](./docs/MVP.md) — the MVP charter: stack, the radicals-first feature, out of scope.
2. [`docs/ROADMAP.md`](./docs/ROADMAP.md) — the slice plan and what is done.
3. [`docs/hanzi_research.md`](./docs/hanzi_research.md) — the learning research the feature rests on.
4. [`lib/radicals/README.md`](./lib/radicals/README.md) — the domain module and its three files.

The MVP's first feature is **learning radicals and common components**.

## Surface

| Route                      | Method | Notes                                         |
| -------------------------- | ------ | --------------------------------------------- |
| `/`                        | GET    | App card                                      |
| `/learn/radicals`          | GET    | Component list, in pedagogical order          |
| `/learn/radicals/[id]`     | GET    | One component: forms, gloss, pinyin, examples |
| `/learn/radicals/practice` | GET    | Recognition practice over the seed pool       |
| `/api/radicals`            | GET    | List response, Zod-validated                  |
| `/api/radicals/[id]`       | GET    | Detail response, Zod-validated                |
| `/api/health`              | GET    | `{ "ok": true, "service": "simplified" }`     |

Route paths and response shapes are a contract. Changing one is a product decision, not a cleanup.

## Rules that are easy to break here

- **The seed is the product, and it is hand-authored.** `lib/radicals/seed.ts` is curated in this
  repository: forms, gloss, pinyin, examples and order. It is not scraped and not generated from a
  corpus. Adding characters is a content decision — check the ordering rationale in
  `lib/radicals/README.md` first. `docs/hanzi_research.md` is a summary of published research with
  citations; it is background for the seed, not a source to copy from.
- **The domain is pure.** Everything under `lib/radicals/` is data and pure functions over it: no
  clock, no environment, no network. The API routes are thin wrappers.
- **Practice randomness is injected, never ambient.** `lib/practice/session.ts` takes a `RandomFn`
  and defaults to `Math.random` only in the browser; tests pass a deterministic one. Do not call
  `Math.random` directly in a module that builds a session or options, and do not read the clock —
  `completedAt` is passed in.
- **Learner progress never leaves the browser.** It lives in `localStorage` under
  `PRACTICE_STORAGE_KEY` (`lib/practice/constants.ts`). There is no account, no server-side progress
  and no analytics. Do not add one.
- **Session constants are declared, not derived.** `PRACTICE_SESSION_SIZE`, `PRACTICE_OPTION_COUNT`
  and `PRACTICE_RECENT_LIMIT` in `lib/practice/constants.ts` are inputs; `docs/MVP.md` explains the
  range they were chosen from. Changing one is a product decision.
- **Glyph shapes are a mainland-simplified concern.** [`docs/FONTS.md`](./docs/FONTS.md) records the
  glyph requirements, including combining forms and radical/compatibility code points that some CJK
  fonts draw as missing-glyph boxes. Read it before touching type.

## Gates

```bash
npm ci
npm run dev             # http://127.0.0.1:43125
bash scripts/ci.sh
bash scripts/verify.sh
```

This app binds port **43125**.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
