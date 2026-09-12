# Foraging model

Departing bees pick a flower patch with probability weighted by remaining nectar × richness
and by advertisements deposited by returning foragers (nectar just unloaded × that patch's
richness); a forager also tends to go back to a patch that last filled its crop.

That is a **toy recruitment model** for the demo. It is not a validated model of honeybee
waggle dancing or of real colony energetics.

Time is simulated: `step(dt)` advances colony time by `dt` seconds. The renderer feeds it
clamped frame deltas; tests feed it whatever they want — ten minutes of colony time does not
take ten minutes of wall-clock.

A visitor can change the nectar on a chosen patch (`boostPatch` / `emptyPatch`) or disturb
the hive (`disturbHive`). Those are colony-state functions; measured effects are in
[`INTERACTIONS.md`](./INTERACTIONS.md).
