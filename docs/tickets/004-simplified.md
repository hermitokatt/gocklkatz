# 004 — Add the Simplified demo

**Linear:** `GOC-8`

**Status: draft.** Scope is agreed; the frozen requirement is not written yet.

## Plain English

Simplified is a learning application for simplified Chinese characters (汉字). A visitor browses
radicals and common components — the building blocks of characters — opens an individual
component to see its glyph, gloss, variants and example characters, and practises recognition.

## Known scope

* Routes `/learn/radicals`, `/learn/radicals/[id]` and `/learn/radicals/practice` in
  `apps/simplified`.
* `GET /api/health` and the radicals API routes.
* A curated set of roughly thirty to fifty high-frequency components, on a structure-first basis
  rather than rote whole-character lists.
* Practice progress is client-local; there is no account, no database and no user data.
* Same requirements as every demo: own `package.json` and lockfile, `scripts/ci.sh`,
  `scripts/verify.sh`, a `repo.config` entry, a Vercel project, and a landing-page card flipped to
  `live` only once its URL returns 200.

## To be decided before freezing

* The exact component set and where its data lives. It must be committed data with a clear
  provenance, not scraped and not of unclear licence — this is a public repository.
* Whether practice progress persists beyond the browser session.
* Whether the app's own dependency list stays a subset of the root allowlist.
