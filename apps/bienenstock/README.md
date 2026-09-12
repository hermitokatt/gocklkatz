# Bienenstock

Outdoor hive scene: a woven skep in a meadow, a colony of bee agents foraging the flower
patches, rendered with `three` and `OrbitControls`. A visitor can boost or empty a flower
patch and watch foragers reallocate, or disturb the hive and watch the colony scatter and
re-home.

## Surface

| Route         | Notes                                      |
| ------------- | ------------------------------------------ |
| `/`           | App card                                   |
| `/bienen`     | 3D scene host (`data-bienen-scene`)        |
| `/api/health` | `{ "ok": true, "service": "bienenstock" }` |

## Run

```bash
npm ci
npm run dev          # http://127.0.0.1:43126
bash scripts/ci.sh
bash scripts/verify.sh
```

Port **43126**. Ameisenwerkstatt is 43123, the landing page 43124, Simplified 43125.

## Colony

The world description (`lib/bienen/world.ts`) is the stage. The colony (`lib/bienen/colony.ts`)
is a pure, seeded simulation: no `three`, no DOM, `step(dt)` advances simulated time. The
renderer reads bee positions; it does not write them.

Default swarm: **120** bees. The on-canvas readout reports the live frame rate at that count.

**Measured, not estimated:** 120 bees render at **60 fps** (vsync-limited) on an Apple M1, with
WebGL reported as `ANGLE (Apple, ANGLE Metal Renderer: Apple M1)` and no console errors. The figure
is read from the app's own readout in a real headless Chrome. Reproduce it with the server running:

```bash
node tools/measure-fps.mjs http://127.0.0.1:43126/bienen 15
```

```json
{
  "url": "http://127.0.0.1:43126/bienen",
  "seconds": 15,
  "readout": "120 bees · 60 fps · hive 142.7 nectar",
  "renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)",
  "consoleErrors": []
}
```

It is a single-machine reading, not a benchmark, and it will differ on other hardware. Chrome's
`--virtual-time-budget` **cannot** be used to obtain it: that flag does not advance
`requestAnimationFrame`, so the page reports `measuring fps` forever and a working scene looks like
a broken one. `tools/measure-fps.mjs` exists because that mistake was made once.

Foraging in one sentence: departing bees pick a patch weighted by remaining nectar × richness
and by advertisements from returning foragers, and they tend to revisit a patch that last
filled their crop. Details, and the "this is a toy model" caveat, are in
[`docs/FORAGING.md`](./docs/FORAGING.md).

Nectar spikes and hive disturbance are functions on colony state. The page only triggers
them. What each does, and the numbers a test actually measured, are in
[`docs/INTERACTIONS.md`](./docs/INTERACTIONS.md).

## Camera

Orbit rather than walk — see [`docs/CAMERA.md`](./docs/CAMERA.md).

## Deploy

Creating the Vercel project and attaching a domain is not part of this work. The demo is not
claimed live from this tree alone.
