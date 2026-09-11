# Ameisenfabrik — what was built

Living ant colony optimization as creation theatre: an operations-research metaheuristic you can
watch work, break, and recover from, rather than a dashboard that reports a number.

**Room demo:** the timed click-through for `/ameisen` is [`docs/DEMO.md`](./DEMO.md) (5–8 minutes:
Lauf/Halt, Chaos/Frei, Kante, the rail of plates).

## Two halves, one simulation

The application is deliberately split in two, and both halves read the same colony math in
`lib/ameisen/`:

| Half | What it is |
| --- | --- |
| **The simulation** | The canvas and 3D stage, the chaos mechanic, and the typed HTTP façade over the colony. |
| **The tool façade** | A small allowlist of named tools (`getTrail`, `getBestTour`, `setParams`, `step`) reachable over one HTTP endpoint, plus a frozen golden bank for scoring a model that drives them. |

No model is hard-locked into the application. No AI SDK is installed. The tool façade is a typed
registry over the same simulation, so an LLM harness can drive the colony without the colony
knowing about it.

## The colony core

- Route `/ameisen` renders a fixed TSP fixture from `lib/ameisen/fixture.ts`.
- Ants are entities; each tour step uses the classic ACO edge weight **τ^α · η^β**.
- Pheromone intensity is visible; the best-so-far tour is highlighted in gold.
- Play / pause (**Lauf / Halt**); the rail carries iteration count and best tour length.
- The ACO math (deposit, evaporate, tour length) is pure TypeScript with numeric Vitest
  assertions — no snapshot tests over rendered pixels.

## The 3D walk graph

- The default live fixture is **exactly 5 cities** (Guss → Herd → Presse → Dock → Tor); the schema
  floor is `.min(5)`.
- A Fibonacci / golden-spiral sphere layout places the cities for display (`n = cities.length`).
  It is N-agnostic: there is no hard-coded `n === 5` or `n === 10` layout path.
- **Distance policy:** ACO distances come from the fixture's **2D `x,y`** through the existing
  Euclidean builder, rebuilding the complete `n×n` matrix for the current city set rather than
  truncating a larger one. The Three.js sphere is **display only**.
- Plain `three` plus OrbitControls: orbit and rotate, zoom via the orbit dolly.
- The graph is complete and undirected; at n=5 all 10 edges are drawable.

## Chaos inject

- An operator blocks or unblocks an undirected edge — by clicking the canvas, by the **Kante**
  select, or by the one-click **Chaos** / **Frei** buttons.
- Blocked edges render dashed magenta with a cut mark; ants skip them while constructing tours.
- Blocking an edge that lies on the gold tour invalidates best-so-far (the plate goes to `—`).
  The colony keeps running and earns a new valid best.
- Vitest covers both directions: a blocked neighbour is excluded from construction, and gold is
  invalidated and then rebuilt without the blocked edge.

## The typed HTTP façade

- Zod schemas in `lib/ameisen/` for the snapshot, the parameters (`alpha`, `beta`, `rho`,
  `antCount`, optional `blockedEdges`) and the step result.
- Route handlers: `GET /api/ameisen/snapshot`, `POST /api/ameisen/params` (400 on invalid input,
  writing nothing), `POST /api/ameisen/step` (advance N iterations).
- One shared server colony reuses the `lib/ameisen` math. There is not a second simulation.
- The `/ameisen` page runs its **own client-local** colony, so sharing the page never requires
  unlocking a write route.

## The tool allowlist

- Allowlisted tools only: `getTrail`, `getBestTour`, `setParams`, `step`, each mapping to the
  existing façade in `lib/ameisen/tools.ts`.
- An unknown name, or a near miss such as `setParam`, returns `tool_refused` rather than being
  fuzzily mapped onto a real tool.
- Parameter mutations are Zod-gated: an invalid genome writes nothing.
- One HTTP entry point: `POST /api/ameisen/tools` with `{ tool, args? }`.
- Golden bank: [`docs/eval/ameisen/`](./eval/ameisen/) — seven goldens plus a dated-run template.
  Goldens never hold scores.

## Writes fail closed

`POST /api/ameisen/params`, `/step` and `/tools` mutate the one shared server colony. On the open
internet that is an anonymous chaos button, so the gate in `lib/ameisen/mutate-gate.ts` fails
closed: with `AMEISEN_MUTATE_SECRET` unset or empty every write answers `403 mutate_forbidden`.
When it is set, a write must present `Authorization: Bearer <secret>`. `GET` routes and the page
itself stay public. See [`../.env.example`](../.env.example).

## The Werkstatt UI

Design research came first and produced four directions; **A — Werkstatt** was picked on the
design review. The layout specification is [`docs/AMEISENFABRIK-UI.md`](./AMEISENFABRIK-UI.md)
§6–§7, and the renders of all four directions are in
[`docs/ameisen-ui-samples/`](./ameisen-ui-samples/).

What shipped: a left rail of plates on `/ameisen`, event punctuation in the rail and the footer,
the same controls as before, and a canvas resize bounded so the rail cannot be pushed around by
the stage.

## Non-goals

A second concurrent graph, node dragging, VR, authentication, retrieval, and a chat surface
without tools. The 3D orbit is display theatre over the live fixture, not a second simulation.
