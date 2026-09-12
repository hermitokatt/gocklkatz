/**
 * Outdoor hive scene for /bienen. The world (ground, vegetation, skep) is the stage; the
 * colony in `./colony` is the action. This module reads simulation state and never feeds
 * positions back into it.
 *
 * Host sizing follows the canvas-display contract: measure the frame, pin the CSS box, pass
 * `false` as the third argument to `renderer.setSize`.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { applyCanvasDisplaySize, resolveCanvasDisplaySize } from "./canvas-display";
import { countBeesInState, step } from "./colony";
import { createRng, type Rng } from "./rng";
import type { Colony } from "./types";
import { FLOWER_PATCHES, SCENERY_SEED } from "./world";

export type HiveScene = {
  resize: () => void;
  render: () => void;
  dispose: () => void;
  stats: () => { fps: number; beeCount: number; hiveNectar: number };
};

/** Deterministic 0..1 from a seed and index — no Math.random in scene construction. */
function hash01(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function createSkep(): THREE.Group {
  const group = new THREE.Group();
  group.name = "skep";

  const straw = new THREE.MeshStandardMaterial({
    color: 0xc4a35a,
    roughness: 0.92,
    metalness: 0.02,
  });
  const strawDark = new THREE.MeshStandardMaterial({
    color: 0x8a6a32,
    roughness: 0.95,
    metalness: 0.02,
  });
  const strawRim = new THREE.MeshStandardMaterial({
    color: 0xd4b56a,
    roughness: 0.88,
    metalness: 0.04,
  });

  // Stacked woven coils tapering into a dome — the silhouette visitors read as a skep.
  const coilCount = 11;
  const baseY = 0.18;
  for (let i = 0; i < coilCount; i++) {
    const t = i / (coilCount - 1);
    const radius = 1.35 * (1 - t * 0.55) + 0.12;
    const tube = 0.11 + (1 - t) * 0.04;
    const y = baseY + i * 0.22;
    const geo = new THREE.TorusGeometry(radius, tube, 10, 48);
    const mesh = new THREE.Mesh(geo, i % 2 === 0 ? straw : strawDark);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Domed cap
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    strawRim,
  );
  cap.position.y = baseY + (coilCount - 1) * 0.22 + 0.08;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  // Visible entrance near the base
  const entrance = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.28, 16),
    new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 1, metalness: 0 }),
  );
  entrance.rotation.x = Math.PI / 2;
  entrance.position.set(0, 0.42, 1.28);
  entrance.castShadow = true;
  group.add(entrance);

  // Small flight board under the entrance
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.06, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x6b4a22, roughness: 0.85, metalness: 0.05 }),
  );
  board.position.set(0, 0.12, 1.45);
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  return group;
}

function createGround(): THREE.Mesh {
  const geo = new THREE.CircleGeometry(28, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3d6b2e,
    roughness: 0.95,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

function createGrass(random: Rng): THREE.InstancedMesh {
  const count = 1400;
  const geo = new THREE.ConeGeometry(0.035, 0.28, 4);
  geo.translate(0, 0.14, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4f8f38,
    roughness: 0.9,
    metalness: 0,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 1.8 + random() * 16;
    // Keep a clear ring around the hive so the skep stays readable.
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.hypot(x, z) < 2.2) {
      dummy.position.set(0, -10, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      continue;
    }
    dummy.position.set(x, 0, z);
    dummy.rotation.y = random() * Math.PI * 2;
    dummy.rotation.z = (random() - 0.5) * 0.25;
    const s = 0.7 + random() * 0.9;
    dummy.scale.set(s, s * (0.8 + random() * 0.6), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.28 + random() * 0.08, 0.45 + random() * 0.25, 0.32 + random() * 0.12);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  return mesh;
}

function createFlowers(random: Rng): THREE.Group {
  const group = new THREE.Group();
  const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.35, 5);
  stemGeo.translate(0, 0.175, 0);
  const bloomGeo = new THREE.SphereGeometry(0.07, 8, 6);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2f6b28, roughness: 0.9 });
  const bloomMats = [
    new THREE.MeshStandardMaterial({
      color: 0xf2c14e,
      roughness: 0.55,
      emissive: 0x3a2800,
      emissiveIntensity: 0.15,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xe85d75,
      roughness: 0.55,
      emissive: 0x3a0010,
      emissiveIntensity: 0.12,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x7ec8e3,
      roughness: 0.55,
      emissive: 0x001828,
      emissiveIntensity: 0.1,
    }),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
  ];

  const stemCount = FLOWER_PATCHES.length * 28;
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, stemCount);
  stems.castShadow = true;
  const blooms = bloomMats.map((mat) => {
    const m = new THREE.InstancedMesh(bloomGeo, mat, Math.ceil(stemCount / bloomMats.length) + 8);
    m.castShadow = true;
    return m;
  });
  const bloomCursor = blooms.map(() => 0);

  const dummy = new THREE.Object3D();
  let stemIndex = 0;
  for (const patch of FLOWER_PATCHES) {
    for (let i = 0; i < 28; i++) {
      const ox = (random() - 0.5) * 2.4;
      const oz = (random() - 0.5) * 2.4;
      dummy.position.set(patch.x + ox, 0, patch.z + oz);
      dummy.rotation.y = random() * Math.PI * 2;
      const s = 0.75 + random() * 0.5;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      stems.setMatrixAt(stemIndex, dummy.matrix);

      const bi = Math.floor(random() * blooms.length);
      const bloom = blooms[bi]!;
      const ci = bloomCursor[bi]!;
      dummy.position.y = 0.35 * s;
      dummy.scale.setScalar(0.9 + random() * 0.5);
      dummy.updateMatrix();
      bloom.setMatrixAt(ci, dummy.matrix);
      bloomCursor[bi] = ci + 1;
      stemIndex += 1;
    }
  }
  stems.instanceMatrix.needsUpdate = true;
  group.add(stems);
  for (let i = 0; i < blooms.length; i++) {
    blooms[i]!.count = bloomCursor[i]!;
    blooms[i]!.instanceMatrix.needsUpdate = true;
    group.add(blooms[i]!);
  }
  return group;
}

function createTrees(random: Rng): THREE.Group {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 8);
  trunkGeo.translate(0, 0.8, 0);
  const canopyGeo = new THREE.SphereGeometry(1.1, 12, 10);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.95 });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x2f6b3a,
    roughness: 0.88,
    metalness: 0,
  });

  const placements: { x: number; z: number; s: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + random() * 0.35;
    const radius = 11 + random() * 8;
    placements.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      s: 0.85 + random() * 0.55,
    });
  }

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, placements.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, placements.length);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  canopies.castShadow = true;
  canopies.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!;
    dummy.position.set(p.x, 0, p.z);
    dummy.scale.set(p.s, p.s, p.s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p.x, 1.7 * p.s, p.z);
    dummy.scale.set(p.s * 1.1, p.s * 0.95, p.s * 1.1);
    dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.32 + hash01(7, i) * 0.06, 0.4, 0.28 + hash01(11, i) * 0.1);
    canopies.setColorAt(i, color);
  }
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) {
    canopies.instanceColor.needsUpdate = true;
  }
  group.add(trunks, canopies);
  return group;
}

function createBeeSwarm(count: number): THREE.InstancedMesh {
  const geo = new THREE.SphereGeometry(0.055, 7, 5);
  geo.scale(1, 0.72, 1.45);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe8b84a,
    roughness: 0.45,
    metalness: 0.05,
    emissive: 0x3a2800,
    emissiveIntensity: 0.12,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    dummy.position.set(0, -20, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.11 + hash01(19, i) * 0.04, 0.72, 0.48 + hash01(23, i) * 0.12);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  return mesh;
}

function writeReadout(
  el: HTMLElement | null,
  fps: number,
  beeCount: number,
  hiveNectar: number,
  scattered: number,
): void {
  if (!el) {
    return;
  }
  const fpsText = fps > 0 ? `${Math.round(fps)} fps` : "measuring fps";
  const scatterText = scattered > 0 ? ` · ${scattered} scattered` : "";
  el.textContent = `${beeCount} bees · ${fpsText} · hive ${hiveNectar.toFixed(1)} nectar${scatterText}`;
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

export function createHiveScene(
  host: HTMLElement,
  readout: HTMLElement | null | undefined,
  colony: Colony,
): HiveScene {
  if (!webglAvailable()) {
    throw new Error("WebGL is not available in this browser.");
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b7e0);
  scene.fog = new THREE.Fog(0x9bc4e8, 22, 48);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  camera.position.set(6.2, 3.4, 8.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x87b7e0, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.cursor = "grab";
  renderer.domElement.setAttribute(
    "aria-label",
    "Bienenstock hive scene: drag to orbit, scroll to zoom",
  );
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = true;
  controls.minDistance = 3.5;
  controls.maxDistance = 22;
  // Keep the camera above the ground plane so the meadow stays underfoot.
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.minPolarAngle = 0.18;
  controls.target.set(0, 1.1, 0);
  controls.update();

  controls.addEventListener("start", () => {
    renderer.domElement.style.cursor = "grabbing";
  });
  controls.addEventListener("end", () => {
    renderer.domElement.style.cursor = "grab";
  });

  // Outdoor lighting: sun with shadows + ambient / sky fill so the shaded hive stays legible.
  scene.add(new THREE.HemisphereLight(0xb8d8ff, 0x4a6b32, 0.55));
  scene.add(new THREE.AmbientLight(0xfff2d8, 0.28));

  const sun = new THREE.DirectionalLight(0xfff0d0, 1.35);
  sun.position.set(10, 16, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.bias = -0.0002;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x8ec5ff, 0.35);
  rim.position.set(-8, 4, -6);
  scene.add(rim);

  const scenery = createRng(SCENERY_SEED);
  scene.add(createGround());
  scene.add(createGrass(scenery));
  scene.add(createFlowers(scenery));
  scene.add(createTrees(scenery));
  scene.add(createSkep());

  const bees = createBeeSwarm(colony.bees.length);
  scene.add(bees);
  const beeDummy = new THREE.Object3D();

  let prevCssWidth = 0;
  let prevCssHeight = 0;
  let frame = 0;
  let disposed = false;
  let lastStamp = performance.now();
  let fpsFrames = 0;
  let fpsWindowMs = 0;
  let fps = 0;

  function syncBees(): void {
    for (let i = 0; i < colony.bees.length; i++) {
      const bee = colony.bees[i]!;
      beeDummy.position.set(bee.x, bee.y, bee.z);
      beeDummy.rotation.set(0.12, bee.heading, Math.sin(colony.time * 22 + bee.phase) * 0.25);
      beeDummy.updateMatrix();
      bees.setMatrixAt(i, beeDummy.matrix);
    }
    bees.instanceMatrix.needsUpdate = true;
  }

  function resize(): void {
    const rect = host.getBoundingClientRect();
    const next = resolveCanvasDisplaySize({
      measuredWidth: rect.width,
      measuredHeight: rect.height,
      devicePixelRatio: window.devicePixelRatio || 1,
      prevCssWidth,
      prevCssHeight,
    });
    prevCssWidth = next.cssWidth;
    prevCssHeight = next.cssHeight;
    applyCanvasDisplaySize(renderer.domElement, next);
    // Third argument false: do not let Three write the canvas CSS size (feedback loop).
    renderer.setSize(next.bitmapWidth, next.bitmapHeight, false);
    camera.aspect = next.cssWidth / Math.max(1, next.cssHeight);
    camera.updateProjectionMatrix();
  }

  function render(): void {
    if (disposed) {
      return;
    }
    const now = performance.now();
    const wallDt = Math.max(0, (now - lastStamp) / 1000);
    lastStamp = now;
    fpsFrames += 1;
    fpsWindowMs += wallDt;
    if (fpsWindowMs >= 1) {
      fps = fpsFrames / fpsWindowMs;
      fpsFrames = 0;
      fpsWindowMs = 0;
      writeReadout(
        readout ?? null,
        fps,
        colony.bees.length,
        colony.hive.nectar,
        countBeesInState(colony, "fleeing"),
      );
    }
    step(colony, Math.min(wallDt, 0.05));
    syncBees();
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  }

  writeReadout(
    readout ?? null,
    0,
    colony.bees.length,
    colony.hive.nectar,
    countBeesInState(colony, "fleeing"),
  );
  syncBees();
  resize();
  frame = requestAnimationFrame(render);

  return {
    resize,
    render: () => {
      controls.update();
      renderer.render(scene, camera);
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const mat of mats) {
            mat.dispose();
          }
        }
      });
    },
    stats: () => ({ fps, beeCount: colony.bees.length, hiveNectar: colony.hive.nectar }),
  };
}
