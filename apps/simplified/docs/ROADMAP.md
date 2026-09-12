# Simplified roadmap

Living ticket-generation SoT for **Simplified**. Linear.app (team **STE**, project Simplified) remains the issue SoT. Humans open STE tickets from this file; Bots implement STEs and do **not** create Linear issues.

Product charter: [`MVP.md`](./MVP.md). Research: [`hanzi_research.md`](./hanzi_research.md). Stack reference: [software-factory-demo](https://cursor.com/codebase/gocklkatz/software-factory-demo).

## Done

| Slice                      | What landed                                               | Key STEs |
| -------------------------- | --------------------------------------------------------- | -------- |
| **SIM-001 — Workplan MVP** | In-repo MVP charter + this roadmap; AGENT/README pointers | STE-72   |

Slices **SIM-002–006** are implemented on stacked feature branches and pending Human merge to the default branch; move them into **Done** after merge.

## Next slices

Draft from here; open STE tickets only as a Human. Prefer one Yellow product STE per wave beside Green docs.

| Slice                               | Intent                                                                                                 | Depends on |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| **SIM-002 — Harness**               | Phase 0: Next 16 / React 19 / TS / Zod health API / Vitest / `scripts/ci.sh` / allowlist / branded `/` | SIM-001    |
| **SIM-003 — Radicals domain + API** | Zod schemas, ~30–50 component seed, `GET /api/radicals` + `GET /api/radicals/[id]`, Vitest             | SIM-002    |
| **SIM-004 — Radicals study UI**     | `/learn/radicals` list + detail (forms, gloss, variants, examples)                                     | SIM-003    |
| **SIM-005 — Recognition practice**  | Practice flow + client-local progress; aids off during recall                                          | SIM-004    |
| **SIM-006 — Deploy + polish**       | Vercel deploy notes + home/share polish so a visitor can use the MVP URL                               | SIM-005    |

### Parked (post-MVP)

| Item                                 | Note                                        |
| ------------------------------------ | ------------------------------------------- |
| Characters + component prerequisites | Frequency/HSK path after radicals bootstrap |
| SRS engine                           | Separate queues; soft caps on new cards     |
| Words / graded reading               | Context after form+meaning+sound            |
| Stroke writing                       | Optional production skill                   |
| Auth / database / AI SDK             | Only with STE + allowlist update            |

## Delivery loop

1. **Human** drafts or opens an STE from Next slices (Plain English first).
2. **Bot** sets **In Progress**, implements, tests, opens a **draft** PR (`Fixes STE-XX`).
3. If blocked: Bot comments on Linear and stops. Bots do not create issues and do not merge.
4. **Human** merges (approval) and marks Linear **Done**.

Refresh this roadmap’s Done / Next after each merge batch lands on the default branch.

## Suggested STE draft bodies

Humans may copy these into Linear. Adjust identifiers after creating issues.

---

### SIM-002 — Phase 0 harness

```md
## Plain English

Stand up the empty Simplified website shell: Next.js App Router, TypeScript, Zod-validated health API, Vitest, CI script, and a branded home page that says what the product is. No radicals feature yet — just a green quality gate and a page a visitor can open.

## Context

MVP charter: docs/MVP.md. Stack pins match software-factory-demo (rewrite, do not copy product code). Repo currently has docs only.

## Acceptance criteria

- [ ] Node 22+, Next App Router, React 19, TypeScript strict
- [ ] GET /api/health returns Zod-validated `{ ok: true, service: "simplified" }` (or equivalent stable service name)
- [ ] Vitest covers health schema/handler
- [ ] bash scripts/ci.sh runs lint, typecheck, test, build
- [ ] docs/DEPENDENCY_ALLOWLIST.md lists allowed direct deps
- [ ] / is a branded shell linking toward future Learn (or a stub Learn pointer)

## Out of scope

Radicals seed/API/UI; auth; database; AI SDK; Tailwind unless allowlisted in this STE.

## Risk

Yellow — first code scaffold; keep blast radius to harness files.

## Done when

ci.sh green locally; Human can open / and /api/health.
```

---

### SIM-003 — Radicals domain + API

```md
## Plain English

Ship the backend for learning radicals: curated seed of ~30–50 common meaning components (with variants like 人/亻), Zod schemas, and list/detail API routes. No study UI yet — API + tests prove the data.

## Context

docs/MVP.md Phase 1 data model. Research: docs/hanzi_research.md §4.

## Acceptance criteria

- [ ] lib/radicals/ schemas + seed (~30–50 components with forms, gloss, examples, order)
- [ ] GET /api/radicals and GET /api/radicals/[id] Zod-validated
- [ ] Unknown id → 404; Vitest covers list, detail, missing id
- [ ] Mainland-simplified font note documented for upcoming UI

## Out of scope

Study/practice UI; writes; auth; full 200+ radical set.

## Risk

Green if harness already merged.

## Done when

curl/list+detail work; tests green under ci.sh.
```

---

### SIM-004 — Radicals study UI

```md
## Plain English

Learners can browse radicals and open a detail page showing forms, meaning, variants, and example characters. Study mode may show teaching aids; this ticket is browse/study only.

## Context

Consumes SIM-003 API. Route: /learn/radicals and /learn/radicals/[id] per docs/MVP.md.

## Acceptance criteria

- [ ] List page shows seed components (glyph + gloss)
- [ ] Detail page shows forms, gloss, variants note, examples
- [ ] Home links into Learn radicals
- [ ] CSS-first UI; simplified-appropriate font wiring started
- [ ] No quiz chrome required yet

## Out of scope

Practice/quiz; SRS; character curriculum unlocks.

## Risk

Yellow — first product UI.

## Done when

Human can click from / through list to a detail page in the browser.
```

---

### SIM-005 — Recognition practice

```md
## Plain English

Add a short radicals recognition practice: see a glyph (or gloss), pick/recall the answer, get feedback. Progress stays in the browser for MVP. Hide study aids while the question is open.

## Context

docs/MVP.md practice flow; research progressive disclosure (hanzi_research.md §6).

## Acceptance criteria

- [ ] Practice route with glyph→meaning and/or meaning→glyph items from seed
- [ ] Aids hidden during question; available after answer or via study
- [ ] Client-local session/progress (localStorage or equivalent)
- [ ] Soft session size cap; Vitest for any pure scoring helpers

## Out of scope

SRS scheduling; accounts; stroke writing.

## Risk

Yellow — interaction surface.

## Done when

Human can complete one practice session without a server account.
```

---

### SIM-006 — Deploy + polish

```md
## Plain English

Put the MVP on a public URL (Vercel) and polish the home page so a visitor understands Simplified and can reach Learn radicals + practice in a few clicks.

## Context

docs/MVP.md deploy lock. Harness + radicals feature should already work locally.

## Acceptance criteria

- [ ] docs/DEPLOY.md (or equivalent) for Vercel ↔ repo
- [ ] Production URL documented in README
- [ ] Home share polish: brand, one headline, CTA into Learn
- [ ] Health endpoint live in production

## Out of scope

Auth; custom domain debates; post-MVP features.

## Risk

Yellow — public URL; no secrets in repo.

## Done when

Human opens the production URL and completes browse + practice smoke.
```

## Out of scope (do not pull into Next as MVP)

- Inventing a second ticket database outside Linear + this ROADMAP draft
- Full literacy curriculum before radicals bootstrap
- Self-merge by Bots
