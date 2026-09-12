# Visitor interactions

The colony forages on its own. Two labelled controls let a visitor disturb it. Both are
functions on colony state in `lib/bienen/colony.ts`; the page only calls them. Time is
simulated (`step(dt)`), never wall-clock, and the interaction path uses the colony RNG —
no `Math.random`.

The visitor chooses a flower patch with on-screen buttons (northeast, northwest, southeast,
southwest, east, north). There is no cursor-picking of patches.

## Nectar spike

`boostPatch(colony, patchId)` adds **80** nectar to that patch, injects an advertisement
proportional to the added nectar × richness, wakes bees waiting in the hive, and turns bees
already outbound or foraging at other patches toward it. Returning bees finish going home
but stop advertising the patch they just left, so the colony does not immediately undo the
spike.

`emptyPatch(colony, patchId)` (a spike to zero) clears that patch's nectar and advertisement
and sends bees working it home. If every patch is empty, departing bees find nothing to
choose and wait in the hive; the run keeps stepping.

**Stated time:** the share of bees working the boosted patch, and new visits to it, shift
in the boosted direction within **20 simulated seconds**.

**Measured** (`./node_modules/.bin/vitest run tests/interactions.test.ts`, seed 19, 24 bees,
two equal patches at ±8, 20 simulated seconds after the boost):

```
nectar-spike seed=19 bees=24 window=20s before working0=1 working1=3
  after working0=9 working1=4 deltaVisits0=71 deltaVisits1=13 reassignedFrom1=3
```

Of the 84 new visits in that window, 71 (85%) were to the boosted patch. Three bees already
working the other patch were turned toward it on the same step as the boost. The remaining
visits to the unboosted patch are bees that chose it later despite the silenced dances
(explore term still sees its nectar).

## Hive disturbance

`disturbHive(colony)` sets every bee to `fleeing` and sends it to a scatter point 7–12
units from the hive, drawn from the colony RNG. On arrival the bee returns to the hive
(`returning` → `inHive`) and resumes the normal foraging cycle.

**Disrupted:** every bee is in `fleeing`.
**Recovered:** no bee remains in `fleeing`; every bee has been `inHive` at least once
since the disturb (re-homing completed); at least one bee is again outbound or foraging.

**Stated time:** recovery completes within **20 simulated seconds**.

**Measured** (`./node_modules/.bin/vitest run tests/interactions.test.ts`, seed 23, 40 bees,
400 steps of 0.05 s = 20 simulated seconds):

```
disturbance seed=23 bees=40 steps=400 window=20s fleeingAfter=0 homed=40
  inHive=1 outbound=8 foraging=14 returning=17
  peakSpread=7.303 spreadAfter=6.200 visitsBefore=80 visitsAfter=191
```

Every bee was `fleeing` on the disturb step. Mean distance from the hive peaked at 7.3
during the scatter (foraging spread is already several units, so spread alone is not the
recovery signal). After 20 s: 0 still fleeing, all 40 had been `inHive` at least once,
and foraging had resumed (visits 80 → 191). Spread after recovery is 6.2 because bees are
out foraging again — that is the stable cycle, not a leftover disruption.

## Determinism

The same seed and the same script — warmup, boost, empty, spike, disturb, step counts —
produce identical fingerprints. Measured in the same test file:

```
interaction-determinism seed=37 bees=40 runA=10215:53de2984 hiveA=70.610000
  runB=10215:53de2984 hiveB=70.610000
```
