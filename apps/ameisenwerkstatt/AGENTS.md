# AGENTS.md — Ameisenwerkstatt

The standing contract for this repository is [`AGENTS.md`](../../AGENTS.md) at the root. It governs.
This file adds only what is specific to this application; where the two ever disagree, the root
file wins and this one is the defect.

## What this app is

A Next.js App Router application: TypeScript strict, Zod on every wire shape, Vitest, ESLint,
Prettier. It is self-contained — its own `package.json`, its own lockfile, its own gates. It does
not import from the landing page or from any other app.

Product background, in reading order:

1. [`docs/AMEISENFABRIK.md`](./docs/AMEISENFABRIK.md) — what was built and why.
2. [`docs/AMEISENFABRIK-UI.md`](./docs/AMEISENFABRIK-UI.md) — the Werkstatt layout, and the
   directions that were rejected.
3. [`docs/eval/`](./docs/eval/README.md) — the frozen tool goldens, and why a golden never holds a
   score.
4. [`docs/DEMO.md`](./docs/DEMO.md) — the room script for `/ameisen`.

## Surface

| Route | Method | Notes |
| --- | --- | --- |
| `/` | GET | The app's own card |
| `/ameisen` | GET | The Werkstatt: canvas, 3D walk graph, chaos controls |
| `/api/health` | GET | `{ "ok": true, "service": "demo-shell" }`, Zod-validated |
| `/api/ameisen/snapshot` | GET | Read-only snapshot of the shared server colony |
| `/api/ameisen/params` | POST | **Mutate-gated** |
| `/api/ameisen/step` | POST | **Mutate-gated** |
| `/api/ameisen/tools` | POST | **Mutate-gated**; allowlisted tools only |

Route paths and response shapes are a contract. Changing one is a product decision, not a cleanup.

## Rules that are easy to break here

- **One simulation.** The UI, the HTTP façade and the tools all read the same colony math in
  `lib/ameisen/`. Do not stand up a second matrix.
- **The write routes fail closed.** With `AMEISEN_MUTATE_SECRET` unset or empty, `params`, `step`
  and `tools` answer `403 mutate_forbidden`. There is no development bypass and no default secret.
  See [`.env.example`](./.env.example).
- **The tool allowlist is exactly four names.** `getTrail`, `getBestTour`, `setParams`, `step`.
  Anything else, including a near miss such as `setParam`, returns `tool_refused` rather than being
  mapped onto a real tool.
- **Invalid input writes nothing.** Zod rejects it and the colony state is untouched — assert the
  state in the test, not only the status code.
- **The edge weight is τ^α · η^β.** Classic ACO. No new metaheuristic without a product decision.
- **Goldens never hold scores.** Pass belongs in a dated run under `docs/eval/ameisen/runs/`.
- **No `Math.random` in render code.** Determinism comes from `createRng`.

## Gates

```bash
npm ci                  # once, from the lockfile
npm run dev             # http://127.0.0.1:43123
bash scripts/ci.sh      # format, lint, typecheck, tests, build
bash scripts/verify.sh  # builds it, serves it, fetches the routes, asserts the responses
```

`scripts/ci.sh` cannot tell you the app works — a build passes over a page that throws on render.
`scripts/verify.sh` is the one that starts the server and probes it. Run both, and paste the output.

This app binds port **43123**. The landing page holds 43124.
