"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./bienen.module.css";

type SceneStatus = "loading" | "ready" | "unavailable" | "failed";

/**
 * Server-renders the scene host (`data-bienen-scene`) before any client JS runs.
 * The Three.js module mounts into that host from an effect; it never creates the host.
 */
export function BienenStage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState<SceneStatus>("loading");
  const [detail, setDetail] = useState<string | null>(null);

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
        scene = createHiveScene(host, readoutRef.current);
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
    };
  }, []);

  return (
    <div className={styles.stage}>
      <header className={styles.mast}>
        <div>
          <p className={styles.kicker}>Demo · outdoor hive · foraging colony</p>
          <h1 className={styles.title}>Bienenstock</h1>
          <p className={styles.sub}>
            A woven skep in a meadow. Bees leave the hive, collect from flower patches, and return —
            recruiting toward richer forage rather than wandering at random. Drag to orbit; scroll
            to zoom.
          </p>
        </div>
      </header>

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
      </footer>
    </div>
  );
}
