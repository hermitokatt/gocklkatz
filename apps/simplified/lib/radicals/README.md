# Radicals domain

Pure domain module for the MVP radicals / meaning-components feature.

| File | Role |
| --- | --- |
| `schema.ts` | Zod schemas for radicals, examples, list/detail responses |
| `seed.ts` | Curated ~30–50 beginner components (forms, gloss, examples, order) |
| `index.ts` | `listRadicals` / `getRadicalById` / `getRadicalDetail` helpers |

API routes: `GET /api/radicals`, `GET /api/radicals/[id]`.

UI font guidance for rendering these glyphs: [`docs/FONTS.md`](../../docs/FONTS.md).
