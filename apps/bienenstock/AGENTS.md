# AGENTS.md — Bienenstock

The standing contract for this repository is [`AGENTS.md`](../../AGENTS.md) at the root. It governs.
This file adds only what is specific to this application.

## What this app is

A Next.js App Router application: TypeScript strict, Zod on the health wire shape, Vitest, ESLint,
Prettier. Self-contained — own `package.json`, lockfile, and gates. It does not import from the
landing page or any other app.

## Surface

| Route | Method | Notes |
| --- | --- | --- |
| `/` | GET | App card |
| `/bienen` | GET | Outdoor hive scene; host carries `data-bienen-scene` in SSR HTML |
| `/api/health` | GET | `{ "ok": true, "service": "bienenstock" }` |

## Rules that are easy to break here

- **Canvas sizing.** Position the canvas absolutely, size it with CSS, pass `false` as the third
  argument to `renderer.setSize`. Measuring with `getBoundingClientRect` while letting the renderer
  write CSS size creates a ResizeObserver feedback loop.
- **Scene host in JSX.** `data-bienen-scene` must be present in server-rendered HTML. Do not create
  the host inside an effect.
- **No simulation yet.** Bee agents and visitor interactions are later epic issues.

## Gates

```bash
npm ci
npm run dev             # http://127.0.0.1:43126
bash scripts/ci.sh
bash scripts/verify.sh
```

This app binds port **43126**.
