# Ameisenwerkstatt

Ant colony optimization on a fixed travelling-salesman problem, with a live 3D workspace you can
orbit, an operator who can cut edges out from under the colony, and a typed HTTP façade over the
same simulation.

A demo application in the [Gocklkatz Inc](../../README.md) portfolio. Self-contained: its own
`package.json`, its own lockfile, its own gates. It imports nothing from the other apps.

| | |
| --- | --- |
| Product notes | [`docs/AMEISENFABRIK.md`](./docs/AMEISENFABRIK.md) |
| Room demo script | [`docs/DEMO.md`](./docs/DEMO.md) |
| Deployment | Not yet deployed. No URL is recorded here until one has been fetched and returned `200`. |

## Run it

Requires **Node 22+**.

```bash
npm ci
npm run dev     # http://127.0.0.1:43123
```

## Surface

| Route | Method | Notes |
| --- | --- | --- |
| `/` | GET | The app's own card |
| `/ameisen` | GET | The Werkstatt: canvas, 3D walk graph, chaos controls |
| `/api/health` | GET | `{ "ok": true, "service": "demo-shell" }` |
| `/api/ameisen/snapshot` | GET | Read-only snapshot of the shared server colony |
| `/api/ameisen/params` | POST | Mutate-gated — sets α, β, ρ, ant count |
| `/api/ameisen/step` | POST | Mutate-gated — advances N iterations |
| `/api/ameisen/tools` | POST | Mutate-gated — allowlisted tools only |

The `/ameisen` page runs its **own colony in the browser**. Nothing on that page writes to the
server, so sharing the URL never requires unlocking anything.

The `POST` routes mutate one **shared server colony**, which on the open internet is an anonymous
chaos button. So they fail closed: with `AMEISEN_MUTATE_SECRET` unset or empty every write answers
`403 mutate_forbidden`, and when it is set a write must carry `Authorization: Bearer <secret>`. See
[`.env.example`](./.env.example) and `lib/ameisen/mutate-gate.ts`.

## Gates

```bash
bash scripts/ci.sh       # format, lint, typecheck, tests, build
bash scripts/verify.sh   # builds it, starts it, fetches /, /ameisen and /api/health
```

`scripts/ci.sh` proves the app compiles and its tests pass. It cannot prove the app *runs*: a build
passes over a page that throws on first render, and a route that answers `200` with an error page
still answers `200`. `scripts/verify.sh` is the one that starts a server on port **43123**, waits
for the port to accept a connection, fetches each route, and asserts what came back — including
that `/ameisen` renders text the working page actually renders. It always shuts the server down,
including on failure, and asserts that the port was released.

## What this application is

- A fixed five-city workshop TSP (`lib/ameisen/fixture.ts`), drawn on a Fibonacci sphere you can
  orbit. The sphere is display only; ACO distances come from the fixture's 2D coordinates.
- Ants constructing tours by the classic ACO edge weight **τ^α · η^β**, with visible pheromone
  intensity and the best-so-far tour in gold.
- A chaos mechanic: block an edge and the ants stop using it. Block an edge on the gold tour and
  best-so-far is invalidated — the plate goes to a dash and the colony has to earn a new one.
- An allowlist of four tools (`getTrail`, `getBestTour`, `setParams`, `step`) over that same
  simulation, so a model harness can drive the colony. No AI SDK is installed and no model name is
  hard-locked into the code.

The colony math is pure TypeScript under `lib/ameisen/` with numeric Vitest assertions. The UI
computes nothing the library does not already export.

## Documents this application does not publish

This repository is public, and the application came from a private working repository whose
documents were written for that setting. Product documents — what was built, why, how it is
demonstrated — were kept and rewritten. The rest was not carried over, and the omission is recorded
here rather than left silent:

| Withheld | Why |
| --- | --- |
| The delivery-loop, roadmap, ticket-schema and ticket-drafting documents | They describe the internal working arrangements of an organisation — named seats, who merges, who may file work. That is not part of a demo, and it names people. |
| The red-gate incident playbook | It is an operator runbook for escalating inside that organisation, not an account of an engineering failure. See below. |
| A field-notes digest of third-party social-media posts | Third-party content and personal handles, gathered under terms this repository has not reviewed. |
| The charter for a different, unbuilt demo | It describes work in another repository against a deadline that is not this one's. |
| The process quiz bank under `docs/eval/` | Its questions are about that organisation's internal loop, so it scores knowledge of the withheld documents. The tool goldens in `docs/eval/ameisen/`, which score the application's actual façade, were kept. |

**On the incident playbook specifically.** It looked like the most publishable of the withheld
documents, because a real account of a real failure is exactly what a portfolio should carry. It is
not that document. It is a decision table for who to notify and which button to press when an
automated agent oversteps inside a particular organisation, written around named individuals, a
named issue tracker and a named hosting platform's settings pages. Strip those out and there is no
engineering content left underneath — no symptom, no diagnosis, no fix. The one genuine engineering
lesson it referenced (that a Chrome debug-port flag is not evidence that the debugger is actually
listening, and that a hung GUI agent should be treated as dead rather than resumed) lived in a
neighbouring operations document, and the root
[`AGENTS.md`](../../AGENTS.md) already settles the question that lesson was about: no browser driver
in any app runtime.

Operational documents that the repository root now owns — the dependency allowlist, deployment, the
review checklist, branch protection, and the browser-agent gate — were dropped rather than
duplicated here. Two copies of a policy is one policy and one lie.

## Naming

The application brands itself **Ameisenfabrik** — that is the wordmark on the page and the name in
its own documents. **Ameisenwerkstatt** is its slot in this portfolio, and *Werkstatt* is the UI
direction that was chosen for `/ameisen`.
