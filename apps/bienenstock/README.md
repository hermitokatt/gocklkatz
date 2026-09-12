# Bienenstock

Outdoor hive scene: a woven skep in a meadow, rendered with `three` and `OrbitControls`.

## Surface

| Route | Notes |
| --- | --- |
| `/` | App card |
| `/bienen` | 3D scene host (`data-bienen-scene`) |
| `/api/health` | `{ "ok": true, "service": "bienenstock" }` |

## Run

```bash
npm ci
npm run dev          # http://127.0.0.1:43126
bash scripts/ci.sh
bash scripts/verify.sh
```

Port **43126**. Ameisenwerkstatt is 43123, the landing page 43124, Simplified 43125.

## Camera

Orbit rather than walk — see [`docs/CAMERA.md`](./docs/CAMERA.md).

## Out of scope (this ticket)

Bee agents, foraging behaviour, nectar spikes, and hive disturbance are separate issues. This app
ships a static scene and a movable camera only.

## Deploy

Creating the Vercel project and attaching a domain is not part of this work. The demo is not
claimed live from this tree alone.
