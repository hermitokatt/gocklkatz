# 003 — Add the Bienenstock demo

**Linear:** `GOC-7`

**Status: draft.** Scope is agreed; the frozen requirement is not written yet. It gets written
when ticket 002 lands, so it can be specified against a real working demo rather than in the
abstract.

## Plain English

Bienenstock is the second simulation demo: a bee colony rendered in 3D — a hive, the nature around
it, and many bee agents whose foraging and hive traffic are visible. A visitor can move through
the scene and disturb it: boost or drop a flower patch and the bees reallocate, or disturb the
hive and the colony scatters and re-homes.

## Known scope

* Route `/bienen` in `apps/bienenstock`.
* 3D scene with a hive and surrounding nature, same rendering stack family as Ameisenwerkstatt.
* Camera movement through the scene.
* Two visitor interactions: a nectar spike and a hive disturbance, both with visible reallocation
  or re-homing behaviour.
* Same requirements as every demo: own `package.json` and lockfile, `scripts/ci.sh`,
  `scripts/verify.sh`, a `repo.config` entry, a Vercel project, and a landing-page card flipped to
  `live` only once its URL returns 200.
* Portfolio-grade presentation. This one is judged on how it looks as much as on what it computes.

## To be decided before freezing

* Whether the simulation runs client-side only or has a server component and an API surface.
* Whether it reuses the 3D approach from Ameisenwerkstatt or takes a different one.
* What "portfolio-grade" means concretely for this scene: a measurable bar, not a vibe.
