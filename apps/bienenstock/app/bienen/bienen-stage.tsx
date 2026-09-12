"use client";

import { useEffect, useRef, useState } from "react";
import {
  boostPatch,
  createColony,
  disturbHive,
  emptyPatch,
  NECTAR_BOOST_AMOUNT,
} from "@/lib/bienen/colony";
import { DEFAULT_BEE_COUNT, DEFAULT_SEED } from "@/lib/bienen/params";
import type { Colony } from "@/lib/bienen/types";
import { FLOWER_PATCHES, PATCH_NAMES } from "@/lib/bienen/world";
import styles from "./bienen.module.css";

type SceneStatus = "loading" | "ready" | "unavailable" | "failed";

function patchName(id: number): string {
  return PATCH_NAMES[id] ?? `patch ${id}`;
}

/**
 * Server-renders the scene host (`data-bienen-scene`) before any client JS runs.
 * The Three.js module mounts into that host from an effect; it never creates the host.
 * Interaction buttons call colony functions; they do not move bees themselves.
 */
export function BienenStage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLParagraphElement>(null);
  const colonyRef = useRef<Colony | null>(null);
  const [status, setStatus] = useState<SceneStatus>("loading");
  const [detail, setDetail] = useState<string | null>(null);
  const [selectedPatchId, setSelectedPatchId] = useState(4);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let scene: { resize: () => void; dispose: () => void } | null = null;
    let observer: ResizeObserver | null = null;

    void (async () => {
      try {
        const { createHiveScene } = await import("@/lib/bienen/scene");
        if (cancelled) {
          return;
        }
        const colony = createColony({ seed: DEFAULT_SEED, beeCount: DEFAULT_BEE_COUNT });
        colonyRef.current = colony;
        scene = createHiveScene(host, readoutRef.current, colony);
        observer = new ResizeObserver(() => {
          scene?.resize();
        });
        observer.observe(host);
        if (!cancelled) {
          setStatus("ready");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Unknown scene error";
        if (/WebGL/i.test(message)) {
          setStatus("unavailable");
          setDetail("WebGL is not available, so the outdoor hive scene cannot start.");
        } else {
          setStatus("failed");
          setDetail(`The hive scene failed to load: ${message}`);
        }
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      scene?.dispose();
      colonyRef.current = null;
    };
  }, []);

  const selectedName = patchName(selectedPatchId);
  const controlsReady = status === "ready";

  return (
    <div className={styles.stage}>
      <header className={styles.mast}>
        <div>
          <p className={styles.kicker}>Demo · outdoor hive · foraging colony</p>
          <h1 className={styles.title}>Bienenstock</h1>
          <p className={styles.sub}>
            A woven skep in a meadow. Bees leave the hive, collect from flower patches, and return —
            recruiting toward richer forage rather than wandering at random. Boost or empty a patch
            and the foragers reallocate; disturb the hive and they scatter, then re-home. Drag to
            orbit; scroll to zoom.
          </p>
        </div>
      </header>

      <section className={styles.controls} aria-label="Colony interactions">
        <p className={styles.controlsLead}>
          Choose a flower patch, then boost its nectar by {NECTAR_BOOST_AMOUNT} or empty it. Bees
          already foraging turn toward a boost and leave an emptied patch. Disturbing the hive
          flings every bee outward; they fly home and resume foraging within 20 simulated seconds.
        </p>
        <div className={styles.controlRow} role="group" aria-label="Choose a flower patch">
          {FLOWER_PATCHES.map((patch) => {
            const name = patchName(patch.id);
            const pressed = selectedPatchId === patch.id;
            return (
              <button
                key={patch.id}
                type="button"
                className={styles.patchPick}
                aria-pressed={pressed}
                onClick={() => setSelectedPatchId(patch.id)}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className={styles.controlRow}>
          <button
            type="button"
            className={styles.action}
            disabled={!controlsReady}
            onClick={() => {
              const colony = colonyRef.current;
              if (!colony) {
                return;
              }
              boostPatch(colony, selectedPatchId);
            }}
          >
            Boost nectar on the {selectedName}
          </button>
          <button
            type="button"
            className={styles.action}
            disabled={!controlsReady}
            onClick={() => {
              const colony = colonyRef.current;
              if (!colony) {
                return;
              }
              emptyPatch(colony, selectedPatchId);
            }}
          >
            Empty the {selectedName}
          </button>
          <button
            type="button"
            className={styles.action}
            disabled={!controlsReady}
            onClick={() => {
              const colony = colonyRef.current;
              if (!colony) {
                return;
              }
              disturbHive(colony);
            }}
          >
            Disturb hive
          </button>
        </div>
      </section>

      <div className={styles.frame}>
        {/* Present in SSR HTML before JS; do not create this host inside an effect. */}
        <div
          ref={hostRef}
          className={styles.canvas}
          data-bienen-scene
          aria-label="Bienenstock 3D hive scene"
        />
        {status === "loading" ? (
          <p className={styles.status} role="status">
            Loading the outdoor hive…
          </p>
        ) : null}
        {status === "unavailable" || status === "failed" ? (
          <p className={styles.status} role="alert">
            {detail ?? "The hive scene is unavailable."}
          </p>
        ) : null}
        <p ref={readoutRef} className={styles.readout} data-bienen-readout aria-live="polite">
          Measuring frame rate…
        </p>
      </div>

      <footer className={styles.foot}>
        <span>
          <strong>Woven skep</strong> · recognisable hive silhouette with a visible entrance
        </span>
        <span>Orbit · pointer drag and wheel · polar angle clamped above the ground</span>
        <span>Colony · instanced bees · simulated time, not wall-clock</span>
        <span>Nectar spike · labelled patch buttons · hive disturbance re-homes within 20 s</span>
      </footer>
    </div>
  );
}
