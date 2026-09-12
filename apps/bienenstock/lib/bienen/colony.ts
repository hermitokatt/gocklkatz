import { DEFAULT_PARAMS, DEFAULT_SEED, type ColonyParams } from "./params";
import { createRng } from "./rng";
import type { Bee, Colony, ColonySnapshot, Patch } from "./types";
import { FLOWER_PATCHES, HIVE_ENTRANCE, type FlowerPatchSpec } from "./world";

export type CreateColonyInput = {
  seed?: number;
  beeCount?: number;
  patches?: readonly FlowerPatchSpec[];
  params?: Partial<ColonyParams>;
};

function hiveSlot(
  id: number,
  hive: { x: number; y: number; z: number },
): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: hive.x + Math.sin(id * 2.31) * 0.28,
    y: hive.y + (id % 7) * 0.05,
    z: hive.z + Math.cos(id * 1.73) * 0.22,
  };
}

function copyPatches(specs: readonly FlowerPatchSpec[]): Patch[] {
  return specs.map((spec) => ({
    id: spec.id,
    x: spec.x,
    z: spec.z,
    richness: spec.richness,
    nectar: spec.initialNectar,
    initialNectar: spec.initialNectar,
    advertisement: 0,
    visits: 0,
    collected: 0,
  }));
}

function spawnBees(count: number, hive: Colony["hive"], random: () => number): Bee[] {
  const bees: Bee[] = [];
  for (let id = 0; id < count; id++) {
    const slot = hiveSlot(id, hive);
    bees.push({
      id,
      x: slot.x,
      y: slot.y,
      z: slot.z,
      heading: id * 0.7,
      state: "inHive",
      patchId: null,
      carried: 0,
      fromX: slot.x,
      fromZ: slot.z,
      toX: slot.x,
      toZ: slot.z,
      progress: 0,
      cruiseAlt: 0.85 + random() * 0.9,
      phase: random() * Math.PI * 2,
      wanderAmp: 0.12 + random() * 0.28,
      rest: 0.12 + random() * 2.4,
      lastPatchId: null,
      lastQuality: 0,
    });
  }
  return bees;
}

export function createColony(input: CreateColonyInput = {}): Colony {
  const params: ColonyParams = {
    ...DEFAULT_PARAMS,
    ...input.params,
    beeCount: input.beeCount ?? input.params?.beeCount ?? DEFAULT_PARAMS.beeCount,
  };
  if (params.beeCount < 1 || !Number.isInteger(params.beeCount)) {
    throw new Error("beeCount must be an integer ≥ 1");
  }
  if (!(params.capacity > 0)) {
    throw new Error("capacity must be > 0");
  }
  const patches = copyPatches(input.patches ?? FLOWER_PATCHES);
  if (patches.length < 1) {
    throw new Error("colony needs at least one flower patch");
  }
  const hive = { ...HIVE_ENTRANCE, nectar: 0 };
  const rng = createRng(input.seed ?? DEFAULT_SEED);
  return {
    time: 0,
    bees: spawnBees(params.beeCount, hive, rng),
    patches,
    hive,
    params,
    rng,
  };
}

function patchById(colony: Colony, id: number | null): Patch | undefined {
  if (id == null) {
    return undefined;
  }
  return colony.patches.find((patch) => patch.id === id);
}

function choosePatch(colony: Colony, bee: Bee): Patch | null {
  const available = colony.patches.filter((patch) => patch.nectar > 1e-9);
  if (available.length === 0) {
    return null;
  }

  const remembered =
    bee.lastPatchId != null ? available.find((patch) => patch.id === bee.lastPatchId) : undefined;
  if (remembered && bee.lastQuality > 0) {
    const fidelity = Math.min(0.85, 0.15 + 0.7 * (bee.lastQuality / colony.params.capacity));
    if (colony.rng() < fidelity) {
      return remembered;
    }
  }

  const weights = available.map(
    (patch) => patch.advertisement + colony.params.explore * patch.richness * patch.nectar,
  );
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  let pick = colony.rng() * sum;
  for (let i = 0; i < available.length; i++) {
    pick -= weights[i]!;
    if (pick <= 0) {
      return available[i]!;
    }
  }
  return available[available.length - 1]!;
}

function fly(bee: Bee, time: number, dt: number, speed: number): void {
  const dx = bee.toX - bee.fromX;
  const dz = bee.toZ - bee.fromZ;
  const dist = Math.hypot(dx, dz) || 1;
  bee.progress = Math.min(1, bee.progress + (speed * dt) / dist);
  const t = bee.progress;
  const alongX = bee.fromX + dx * t;
  const alongZ = bee.fromZ + dz * t;
  const perpX = -dz / dist;
  const perpZ = dx / dist;
  const envelope = Math.sin(Math.PI * t);
  const wobble = Math.sin(time * 5.4 + bee.phase) * bee.wanderAmp * envelope;
  bee.x = alongX + perpX * wobble;
  bee.z = alongZ + perpZ * wobble;
  bee.y = 0.32 + bee.cruiseAlt * envelope;
  bee.heading = Math.atan2(dx, dz);
}

function hoverAtPatch(bee: Bee, patch: Patch, time: number): void {
  const orbit = 0.35 + bee.wanderAmp;
  bee.x = patch.x + Math.cos(time * 2.2 + bee.phase) * orbit;
  bee.z = patch.z + Math.sin(time * 2.2 + bee.phase) * orbit;
  bee.y = 0.45 + 0.18 * Math.sin(time * 7 + bee.phase);
  bee.heading = time * 2.2 + bee.phase + Math.PI / 2;
}

function collect(bee: Bee, colony: Colony, dt: number): void {
  const patch = patchById(colony, bee.patchId);
  if (!patch) {
    return;
  }
  const room = colony.params.capacity - bee.carried;
  if (room <= 0 || patch.nectar <= 0) {
    return;
  }
  const take = Math.min(room, patch.nectar, colony.params.collectRate * patch.richness * dt);
  bee.carried += take;
  patch.nectar -= take;
  patch.collected += take;
}

function unload(bee: Bee, colony: Colony): void {
  colony.hive.nectar += bee.carried;
  const patch = patchById(colony, bee.patchId);
  if (patch && bee.carried > 0) {
    patch.advertisement += bee.carried * patch.richness;
  }
  bee.lastPatchId = bee.patchId;
  bee.lastQuality = bee.carried;
  bee.carried = 0;
  bee.patchId = null;
}

function beginLeg(bee: Bee, toX: number, toZ: number): void {
  bee.fromX = bee.x;
  bee.fromZ = bee.z;
  bee.toX = toX;
  bee.toZ = toZ;
  bee.progress = 0;
}

function stepBee(colony: Colony, bee: Bee, dt: number): void {
  switch (bee.state) {
    case "inHive": {
      const slot = hiveSlot(bee.id, colony.hive);
      bee.x = slot.x;
      bee.y = slot.y;
      bee.z = slot.z;
      bee.rest -= dt;
      if (bee.rest > 0) {
        return;
      }
      const patch = choosePatch(colony, bee);
      if (!patch) {
        bee.rest = 0.4;
        return;
      }
      bee.patchId = patch.id;
      bee.state = "outbound";
      beginLeg(bee, patch.x, patch.z);
      return;
    }
    case "outbound": {
      fly(bee, colony.time, dt, colony.params.flySpeed);
      if (bee.progress < 1) {
        return;
      }
      const patch = patchById(colony, bee.patchId);
      if (patch) {
        patch.visits += 1;
      }
      bee.state = "foraging";
      bee.rest = 0.7 + (bee.phase % 1) * 0.8;
      return;
    }
    case "foraging": {
      const patch = patchById(colony, bee.patchId);
      if (patch) {
        hoverAtPatch(bee, patch, colony.time);
        collect(bee, colony, dt);
      }
      bee.rest -= dt;
      const full = bee.carried >= colony.params.capacity - 1e-9;
      const empty = patch != null && patch.nectar <= 1e-9;
      if (bee.rest > 0 && !full && !empty) {
        return;
      }
      bee.state = "returning";
      beginLeg(bee, colony.hive.x, colony.hive.z);
      return;
    }
    case "returning": {
      fly(bee, colony.time, dt, colony.params.flySpeed);
      if (bee.progress < 1) {
        return;
      }
      unload(bee, colony);
      bee.state = "inHive";
      bee.rest = 0.3 + (bee.phase % 1) * 0.55;
      return;
    }
  }
}

/**
 * Advance simulated colony time by `dt` seconds. Wall-clock is not consulted.
 * Mutates `colony` and returns it.
 */
export function step(colony: Colony, dt: number): Colony {
  if (!(dt > 0) || !Number.isFinite(dt)) {
    return colony;
  }
  colony.time += dt;
  const decay = Math.exp(-colony.params.adDecay * dt);
  for (const patch of colony.patches) {
    patch.advertisement *= decay;
  }
  for (const bee of colony.bees) {
    stepBee(colony, bee, dt);
  }
  return colony;
}

export function snapshot(colony: Colony): ColonySnapshot {
  return {
    time: colony.time,
    hiveNectar: colony.hive.nectar,
    patches: colony.patches.map((patch) => ({
      id: patch.id,
      nectar: patch.nectar,
      advertisement: patch.advertisement,
      visits: patch.visits,
      collected: patch.collected,
    })),
    bees: colony.bees.map((bee) => ({
      id: bee.id,
      x: bee.x,
      y: bee.y,
      z: bee.z,
      heading: bee.heading,
      state: bee.state,
      patchId: bee.patchId,
      carried: bee.carried,
      progress: bee.progress,
      rest: bee.rest,
      lastPatchId: bee.lastPatchId,
      lastQuality: bee.lastQuality,
    })),
  };
}

export function fingerprint(colony: Colony): string {
  return JSON.stringify(snapshot(colony));
}
