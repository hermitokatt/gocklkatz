# AGENTS.md — Bienenstock

The standing contract for this repository is [`AGENTS.md`](../../AGENTS.md) at the root. It governs.
This file adds only what is specific to this application.

## What this app is

A Next.js App Router application: TypeScript strict, Zod on the health wire shape, Vitest, ESLint,
Prettier. Self-contained — own `package.json`, lockfile, and gates. It does not import from the
landing page or any other app.

## Surface

| Route         | Method | Notes                                                            |
| ------------- | ------ | ---------------------------------------------------------------- |
| `/`           | GET    | App card                                                         |
| `/bienen`     | GET    | Outdoor hive scene; host carries `data-bienen-scene` in SSR HTML |
| `/api/health` | GET    | `{ "ok": true, "service": "bienenstock" }`                       |

## Rules that are easy to break here

- **Canvas sizing.** Position the canvas absolutely, size it with CSS, pass `false` as the third
  argument to `renderer.setSize`. Measuring with `getBoundingClientRect` while letting the renderer
  write CSS size creates a ResizeObserver feedback loop.
- **Scene host in JSX.** `data-bienen-scene` must be present in server-rendered HTML. Do not create
  the host inside an effect.
- **Simulation is pure.** `lib/bienen/colony.ts` imports nothing from `three` and touches no DOM.
  Time is `step(dt)`, not wall-clock. The renderer reads colony state; it does not write positions
  back. `Math.random` is forbidden in the simulation — use `createRng`.
- **One scenery stream, one colony stream.** The meadow RNG (`SCENERY_SEED`) and the colony seed
  are separate instances. Do not insert draws into the scenery stream above existing ones.

## Gates

```bash
npm ci
npm run dev             # http://127.0.0.1:43126
bash scripts/ci.sh
bash scripts/verify.sh
```

This app binds port **43126**.
