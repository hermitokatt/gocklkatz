/**
 * Three.js walk-graph for Ameisenfabrik (STE-54).
 * Display layout = Fibonacci sphere; ACO distances stay on fixture x/y.
 * Host sizing follows STE-42 (measure frame, pin CSS box, no intrinsic feedback loop).
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import {
  applyCanvasDisplaySize,
  edgeKey,
  fibonacciSphereLayout,
  maxPheromone,
  resolveCanvasDisplaySize,
  type Colony,
  type Vec3,
} from "@/lib/ameisen";

export type Crawl = {
  antId: number;
  from: number;
  to: number;
  progress: number;
};

const SPHERE_RADIUS = 5;
const CITY_MESH_RADIUS = 0.2;
/** World-units per second along an edge (N-agnostic; scales with sphere size). */
export const ANT_SPEED_WORLD = 3.2;
const HIT_RADIUS = 0.14;

type EdgeMeshes = {
  key: string;
  i: number;
  j: number;
  line: THREE.Line;
  trailMat: THREE.LineBasicMaterial;
  hit: THREE.Mesh;
};

export type ColonyGraph3D = {
  resize: () => void;
  sync: (colony: Colony, crawls: Crawl[]) => void;
  render: () => void;
  pickEdgeAt: (clientX: number, clientY: number) => [number, number] | null;
  /** True if the last pointer gesture moved enough to count as orbit, not a click. */
  consumeOrbitGesture: () => boolean;
  edgeWorldLength: (from: number, to: number) => number;
  dispose: () => void;
};

function makeCityLabel(name: string): CSS2DObject {
  const el = document.createElement("div");
  el.className = "ameisen-city-label";
  el.textContent = name;
  el.style.color = "#f4ead5";
  el.style.font = '700 12px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  el.style.textShadow = "0 1px 3px #000, 0 0 8px rgba(0,0,0,0.8)";
  el.style.pointerEvents = "none";
  el.style.userSelect = "none";
  el.style.whiteSpace = "nowrap";
  const obj = new CSS2DObject(el);
  obj.position.set(0, CITY_MESH_RADIUS + 0.28, 0);
  return obj;
}

function alignCylinder(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mesh.position.copy(mid);
  const dir = b.clone().sub(a);
  const len = Math.max(1e-6, dir.length());
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
}

export function createColonyGraph3D(host: HTMLElement): ColonyGraph3D {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0a0e);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(7.5, 4.2, 9.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x0b0a0e, 1);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.cursor = "grab";
  renderer.domElement.setAttribute(
    "aria-label",
    "Ameisenfabrik Kolonie: Orbit drehen · Kante anklicken zum Sperren oder Freigeben",
  );
  host.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.inset = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  host.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 22;
  controls.target.set(0, 0, 0);
  controls.update();

  let orbitMoved = false;
  controls.addEventListener("start", () => {
    orbitMoved = false;
    renderer.domElement.style.cursor = "grabbing";
  });
  controls.addEventListener("change", () => {
    orbitMoved = true;
  });
  controls.addEventListener("end", () => {
    renderer.domElement.style.cursor = "grab";
  });

  scene.add(new THREE.AmbientLight(0xffe0c0, 0.55));
  const key = new THREE.DirectionalLight(0xff9a4a, 1.15);
  key.position.set(6, 10, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x4ad0ff, 0.35);
  fill.position.set(-5, -2, -6);
  scene.add(fill);

  const graphRoot = new THREE.Group();
  scene.add(graphRoot);

  const positions: THREE.Vector3[] = [];
  const cityLabels: CSS2DObject[] = [];
  let edges: EdgeMeshes[] = [];
  let goldLine: THREE.Line | null = null;
  const antMeshes = new Map<number, THREE.Mesh>();

  const cityGeo = new THREE.SphereGeometry(CITY_MESH_RADIUS, 20, 16);
  const cityMat = new THREE.MeshStandardMaterial({
    color: 0xff7a18,
    emissive: 0x4a1800,
    metalness: 0.2,
    roughness: 0.45,
  });

  const blockedMat = new THREE.LineDashedMaterial({
    color: 0xff3060,
    dashSize: 0.22,
    gapSize: 0.14,
  });
  const goldMat = new THREE.LineBasicMaterial({
    color: 0xffd000,
    transparent: true,
    opacity: 0.95,
  });
  const baseMat = new THREE.LineBasicMaterial({
    color: 0x3a342c,
    transparent: true,
    opacity: 0.55,
  });
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitGeo = new THREE.CylinderGeometry(HIT_RADIUS, HIT_RADIUS, 1, 8);

  const antGeo = new THREE.ConeGeometry(0.12, 0.34, 8);
  const antMat = new THREE.MeshStandardMaterial({
    color: 0xff3b00,
    emissive: 0x661400,
    metalness: 0.1,
    roughness: 0.5,
  });

  let prevCssWidth = 0;
  let prevCssHeight = 0;
  let layoutN = -1;

  function clearGraph(): void {
    while (graphRoot.children.length > 0) {
      const child = graphRoot.children[0]!;
      graphRoot.remove(child);
    }
    for (const label of cityLabels) {
      label.element.remove();
    }
    for (const edge of edges) {
      edge.line.geometry.dispose();
      edge.trailMat.dispose();
    }
    if (goldLine) {
      goldLine.geometry.dispose();
      goldLine = null;
    }
    cityLabels.length = 0;
    positions.length = 0;
    edges = [];
    for (const mesh of antMeshes.values()) {
      scene.remove(mesh);
    }
    antMeshes.clear();
  }

  function rebuildLayout(n: number, names: readonly string[]): void {
    clearGraph();
    layoutN = n;
    const layout: Vec3[] = fibonacciSphereLayout(n, SPHERE_RADIUS);
    for (let i = 0; i < n; i++) {
      const p = layout[i]!;
      const v = new THREE.Vector3(p.x, p.y, p.z);
      positions.push(v);
      const mesh = new THREE.Mesh(cityGeo, cityMat);
      mesh.position.copy(v);
      graphRoot.add(mesh);
      const label = makeCityLabel(names[i] ?? `C${i}`);
      mesh.add(label);
      cityLabels.push(label);
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = positions[i]!;
        const b = positions[j]!;
        const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
        const trailMat = new THREE.LineBasicMaterial({
          color: 0x19d7ff,
          transparent: true,
          opacity: 0.35,
        });
        const line = new THREE.Line(geo, baseMat);
        line.computeLineDistances();
        graphRoot.add(line);

        const hit = new THREE.Mesh(hitGeo, hitMat);
        alignCylinder(hit, a, b);
        hit.userData = { edgeI: i, edgeJ: j };
        graphRoot.add(hit);

        edges.push({ key: edgeKey(i, j), i, j, line, trailMat, hit });
      }
    }
  }

  function ensureAnt(id: number): THREE.Mesh {
    let mesh = antMeshes.get(id);
    if (!mesh) {
      mesh = new THREE.Mesh(antGeo, antMat);
      scene.add(mesh);
      antMeshes.set(id, mesh);
    }
    return mesh;
  }

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const next = resolveCanvasDisplaySize({
      measuredWidth: host.clientWidth,
      measuredHeight: host.clientHeight,
      devicePixelRatio: dpr,
      prevCssWidth,
      prevCssHeight,
    });
    prevCssWidth = next.cssWidth;
    prevCssHeight = next.cssHeight;
    // STE-42: pin CSS box on the WebGL canvas; setPixelRatio(1) so setSize
    // writes the already-resolved bitmap size and cannot feed layout.
    renderer.setPixelRatio(1);
    renderer.setSize(next.bitmapWidth, next.bitmapHeight, false);
    applyCanvasDisplaySize(renderer.domElement, next);
    camera.aspect = next.cssWidth / Math.max(1, next.cssHeight);
    camera.updateProjectionMatrix();
    labelRenderer.setSize(next.cssWidth, next.cssHeight);
  }

  function sync(colony: Colony, crawls: Crawl[]): void {
    const n = colony.cities.length;
    if (n !== layoutN) {
      rebuildLayout(
        n,
        colony.cities.map((c) => c.name),
      );
    } else {
      for (let i = 0; i < n; i++) {
        const label = cityLabels[i];
        if (label) {
          label.element.textContent = colony.cities[i]!.name;
        }
      }
    }

    const peak = Math.max(maxPheromone(colony.tau), colony.params.tau0);

    for (const edge of edges) {
      const blocked = colony.blockedEdges.has(edge.key);
      const intensity = colony.tau[edge.i]![edge.j]! / peak;
      if (blocked) {
        edge.line.material = blockedMat;
        edge.line.computeLineDistances();
      } else if (intensity > 0.02) {
        edge.trailMat.opacity = 0.12 + intensity * 0.78;
        edge.line.material = edge.trailMat;
      } else {
        // Keep every undirected edge drawable (complete graph), faint when cold.
        edge.line.material = baseMat;
      }
    }

    if (goldLine) {
      graphRoot.remove(goldLine);
      goldLine.geometry.dispose();
      goldLine = null;
    }
    if (colony.bestTour && colony.bestTour.length > 1) {
      const pts: THREE.Vector3[] = [];
      for (const idx of colony.bestTour) {
        const p = positions[idx];
        if (p) {
          pts.push(p);
        }
      }
      const first = colony.bestTour[0]!;
      if (positions[first]) {
        pts.push(positions[first]!);
      }
      if (pts.length > 1) {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        goldLine = new THREE.Line(geo, goldMat);
        graphRoot.add(goldLine);
      }
    }

    const live = new Set(crawls.map((c) => c.antId));
    for (const [id, mesh] of antMeshes) {
      if (!live.has(id)) {
        scene.remove(mesh);
        antMeshes.delete(id);
      }
    }

    for (const crawl of crawls) {
      const a = positions[crawl.from];
      const b = positions[crawl.to];
      if (!a || !b) {
        continue;
      }
      const mesh = ensureAnt(crawl.antId);
      const t = Math.min(1, Math.max(0, crawl.progress));
      mesh.position.lerpVectors(a, b, t);
      if (crawl.from !== crawl.to) {
        const dir = b.clone().sub(a).normalize();
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      }
    }
  }

  function render(): void {
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pickEdgeAt(clientX: number, clientY: number): [number, number] | null {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(
      edges.map((e) => e.hit),
      false,
    );
    if (hits.length === 0) {
      return null;
    }
    const data = hits[0]!.object.userData as { edgeI?: number; edgeJ?: number };
    if (typeof data.edgeI === "number" && typeof data.edgeJ === "number") {
      return [data.edgeI, data.edgeJ];
    }
    return null;
  }

  function consumeOrbitGesture(): boolean {
    const moved = orbitMoved;
    orbitMoved = false;
    return moved;
  }

  function edgeWorldLength(from: number, to: number): number {
    const a = positions[from];
    const b = positions[to];
    if (!a || !b) {
      return SPHERE_RADIUS;
    }
    return Math.max(0.35, a.distanceTo(b));
  }

  function dispose(): void {
    clearGraph();
    controls.dispose();
    cityGeo.dispose();
    cityMat.dispose();
    blockedMat.dispose();
    goldMat.dispose();
    baseMat.dispose();
    hitMat.dispose();
    hitGeo.dispose();
    antGeo.dispose();
    antMat.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    labelRenderer.domElement.remove();
  }

  return {
    resize,
    sync,
    render,
    pickEdgeAt,
    consumeOrbitGesture,
    edgeWorldLength,
    dispose,
  };
}
