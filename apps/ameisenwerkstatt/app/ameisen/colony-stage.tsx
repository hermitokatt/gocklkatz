"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AMEISEN_TSP_FIXTURE,
  allAntsDone,
  blockedEdgeCount,
  blockedEdgeNames,
  clearBlockedEdges,
  closeIteration,
  colonyProgress,
  createColony,
  createRng,
  DEFAULT_ACO_PARAMS,
  edgeKey,
  formatColonyParams,
  formatDecisionProbability,
  goldTourNames,
  injectChaos,
  isAntDone,
  iterationSpread,
  parseEdgeKey,
  pheromonePeak,
  pheromoneTotalMass,
  stepAnt,
  tauOnGoldShare,
  toggleBlockedEdge,
  topDecisionPeek,
  type City,
  type Colony,
} from "@/lib/ameisen";
import styles from "./ameisen.module.css";
import { ANT_SPEED_WORLD, createColonyGraph3D, type Crawl } from "./colony-graph-3d";
import { Rail, type RailModel } from "./rail";

type HudHistory = {
  bestSinceIteration: number;
  lastGoldLength: number | null;
  lastGoldIteration: number | null;
  preChaosBest: number | null;
  chaosAtIteration: number | null;
  massBeforeBlock: number | null;
  blockedSinceIteration: number | null;
  lastSpreadBest: number | null;
  lastSpreadWorst: number | null;
  recoveryNote: string | null;
  flashUntilMs: number;
  heartbeatUntilMs: number;
  prevBestTour: boolean;
  prevBestLength: number;
  prevBlockedCount: number;
  prevAllHome: boolean;
};

type FooterSlot =
  | { kind: "chain"; names: string[] }
  | { kind: "event"; edgeLabel: string; iteration: number; goldDiscarded: boolean }
  | { kind: "empty" };

type HudView = {
  rail: RailModel;
  footer: FooterSlot;
  paramsLine: string;
  chaosActive: boolean;
  goldDiscarded: boolean;
  blockedCount: number;
  eventEdgeLabel: string | null;
};

const HUD_INTERVAL_S = 1 / 8;
const FLASH_MS = 1500;
const HEARTBEAT_MS = 450;

const SUB_CALM =
  "Live ACO auf einem festen 5-Städte-TSP (Fibonacci-Kugel, Orbit). Kante sperren — Ameisen meiden sie. Gold kann fallen, dann erholt sich die Kolonie. Klassisch τ^α · η^β, keine neue Mathematik.";

function beginCrawls(colony: Colony, random: () => number): { colony: Colony; crawls: Crawl[] } {
  let next = colony;
  const crawls: Crawl[] = [];
  for (let antIndex = 0; antIndex < next.ants.length; antIndex++) {
    const before = next.ants[antIndex]!;
    if (isAntDone(before, next.cities.length)) {
      const last = before.tour[before.tour.length - 1]!;
      crawls.push({ antId: before.id, from: last, to: last, progress: 1 });
      continue;
    }
    const from = before.tour[before.tour.length - 1]!;
    next = stepAnt(next, antIndex, random);
    const to = next.ants[antIndex]!.tour.at(-1)!;
    crawls.push({ antId: before.id, from, to, progress: 0 });
  }
  return { colony: next, crawls };
}

function formatLength(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(1);
}

function formatMass(value: number): string {
  return value.toFixed(1);
}

function formatPeak(value: number): string {
  return value.toFixed(2);
}

function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function edgeOptions(cities: readonly City[]): { key: string; label: string }[] {
  const options: { key: string; label: string }[] = [];
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      options.push({
        key: edgeKey(i, j),
        label: `${cities[i]!.name}–${cities[j]!.name}`,
      });
    }
  }
  return options;
}

function initialHistory(): HudHistory {
  return {
    bestSinceIteration: 0,
    lastGoldLength: null,
    lastGoldIteration: null,
    preChaosBest: null,
    chaosAtIteration: null,
    massBeforeBlock: null,
    blockedSinceIteration: null,
    lastSpreadBest: null,
    lastSpreadWorst: null,
    recoveryNote: null,
    flashUntilMs: 0,
    heartbeatUntilMs: 0,
    prevBestTour: false,
    prevBestLength: Number.POSITIVE_INFINITY,
    prevBlockedCount: 0,
    prevAllHome: false,
  };
}

function updateHistory(history: HudHistory, colony: Colony, nowMs: number): HudHistory {
  const next = { ...history };
  const hasGold = colony.bestTour !== null && Number.isFinite(colony.bestLength);
  const blockedCount = blockedEdgeCount(colony.blockedEdges);
  const progress = colonyProgress(colony);
  const spread = iterationSpread(colony);

  if (spread.validCount > 0) {
    next.lastSpreadBest = spread.best;
    next.lastSpreadWorst = spread.worst;
  }

  if (blockedCount > history.prevBlockedCount) {
    next.blockedSinceIteration = colony.iteration;
    // Prefer mass captured by the control handler before τ on the edge was zeroed.
    if (history.massBeforeBlock === null) {
      next.massBeforeBlock = pheromoneTotalMass(colony);
    }
    if (history.prevBestTour && !hasGold && Number.isFinite(history.prevBestLength)) {
      next.preChaosBest = history.prevBestLength;
      next.chaosAtIteration = colony.iteration;
      next.lastGoldLength = history.prevBestLength;
      next.lastGoldIteration = colony.iteration;
      next.recoveryNote = null;
    }
  }

  if (blockedCount === 0 && history.prevBlockedCount > 0) {
    next.blockedSinceIteration = null;
    next.massBeforeBlock = null;
    next.preChaosBest = null;
    next.chaosAtIteration = null;
  }

  if (history.prevBestTour && !hasGold && Number.isFinite(history.prevBestLength)) {
    next.lastGoldLength = history.prevBestLength;
    next.lastGoldIteration = colony.iteration;
    if (next.preChaosBest === null) {
      next.preChaosBest = history.prevBestLength;
      next.chaosAtIteration = colony.iteration;
    }
  }

  if (!history.prevBestTour && hasGold) {
    next.bestSinceIteration = colony.iteration;
    if (history.preChaosBest !== null && Number.isFinite(history.preChaosBest)) {
      const delta = colony.bestLength - history.preChaosBest;
      const sign = delta >= 0 ? "+" : "";
      const took =
        history.chaosAtIteration !== null
          ? Math.max(1, colony.iteration - history.chaosAtIteration)
          : 1;
      next.recoveryNote = `vor Chaos ${formatLength(history.preChaosBest)} · ${sign}${formatLength(delta)} · neu in ${took} Iteration`;
      next.flashUntilMs = nowMs + FLASH_MS;
      next.preChaosBest = null;
      next.chaosAtIteration = null;
    } else if (
      Number.isFinite(history.prevBestLength) &&
      colony.bestLength < history.prevBestLength
    ) {
      next.flashUntilMs = nowMs + FLASH_MS;
      next.recoveryNote = null;
    }
  } else if (
    hasGold &&
    Number.isFinite(history.prevBestLength) &&
    colony.bestLength < history.prevBestLength
  ) {
    next.bestSinceIteration = colony.iteration;
    next.flashUntilMs = nowMs + FLASH_MS;
    next.recoveryNote = null;
  }

  if (progress.allHome && !history.prevAllHome) {
    next.heartbeatUntilMs = nowMs + HEARTBEAT_MS;
  }

  next.prevBestTour = hasGold;
  next.prevBestLength = hasGold ? colony.bestLength : history.prevBestLength;
  next.prevBlockedCount = blockedCount;
  next.prevAllHome = progress.allHome;
  return next;
}

function buildHud(colony: Colony, history: HudHistory, nowMs: number): HudView {
  const progress = colonyProgress(colony);
  const blocked = blockedEdgeNames(colony);
  const blockedCount = blocked.length;
  const chaosActive = blockedCount > 0;
  const hasGold = colony.bestTour !== null && Number.isFinite(colony.bestLength);
  const share = tauOnGoldShare(colony);
  const mass = pheromoneTotalMass(colony);
  const peak = pheromonePeak(colony);
  const goldNames = goldTourNames(colony);
  const edgeLabel = blocked[0]?.label ?? null;

  const iterationBest =
    history.lastSpreadBest !== null ? Math.round(history.lastSpreadBest) : null;
  const spreadBest = history.lastSpreadBest;
  const spreadWorst = history.lastSpreadWorst;

  let besteTour: RailModel["besteTour"];
  if (!hasGold && chaosActive) {
    besteTour = {
      label: "Beste Tour",
      value: "—",
      tone: "magenta",
      alert: true,
      noteLines: [
        "Gold verworfen · die Sperre lag auf der Tour",
        history.lastGoldLength !== null && history.lastGoldIteration !== null
          ? `zuletzt ${formatLength(history.lastGoldLength)} in Iteration ${history.lastGoldIteration}`
          : "Gold verworfen",
      ],
    };
  } else {
    const noteLines: string[] = [];
    if (history.recoveryNote) {
      noteLines.push(history.recoveryNote);
    } else {
      noteLines.push(`unverändert seit Iteration ${history.bestSinceIteration}`);
    }
    noteLines.push(
      iterationBest !== null
        ? `bester Lauf dieser Iteration ${iterationBest}`
        : "bester Lauf dieser Iteration —",
    );
    besteTour = {
      label: "Beste Tour",
      value: formatLength(colony.bestLength),
      tone: "gold",
      flash: nowMs < history.flashUntilMs,
      noteLines,
    };
  }

  const iteration: RailModel["iteration"] = {
    label: "Iteration",
    value: String(colony.iteration),
    tone: "green",
    heartbeat: nowMs < history.heartbeatUntilMs,
    noteLines: [
      `${progress.walking} von ${progress.total} Ameisen unterwegs`,
      `weiteste Ameise bei Hop ${progress.furthestHop}/${progress.cityCount}`,
    ],
  };

  let pheromon: RailModel["pheromon"];
  if (share === null) {
    pheromon = {
      label: "Pheromon · Masse",
      value: formatMass(mass),
      tone: "cyan",
      noteLines: [
        "Anteil auf Gold ruht, bis neues Gold steht",
        history.massBeforeBlock !== null
          ? `vor der Sperre ${formatMass(history.massBeforeBlock)} · Spitze ${formatPeak(peak)}`
          : `Masse ${formatMass(mass)} · Spitze ${formatPeak(peak)}`,
      ],
    };
  } else {
    pheromon = {
      label: "Pheromon",
      value: formatPercent(share),
      tone: "cyan",
      noteLines: [
        "des Pheromons liegt auf der Gold-Tour",
        `Masse ${formatMass(mass)} · Spitze ${formatPeak(peak)}`,
      ],
    };
  }

  let gesperrt: RailModel["gesperrt"];
  if (chaosActive) {
    gesperrt = {
      label: "Gesperrt",
      value: String(blockedCount),
      tone: "magenta",
      alert: true,
      noteLines: [
        edgeLabel !== null && history.blockedSinceIteration !== null
          ? `${edgeLabel} · seit Iteration ${history.blockedSinceIteration}`
          : edgeLabel ?? `${blockedCount} Kanten gesperrt`,
        "Touren über die Sperre werden verworfen",
      ],
    };
  } else {
    const spreadNote =
      spreadBest !== null && spreadWorst !== null
        ? `Touren dieser Iteration ${Math.round(spreadBest)}–${Math.round(spreadWorst)}`
        : "Touren dieser Iteration —";
    gesperrt = {
      label: "Gesperrt",
      value: "0",
      tone: "magenta",
      noteLines: ["Kanten gesperrt", spreadNote],
    };
  }

  let footer: FooterSlot;
  if (chaosActive && !hasGold && edgeLabel) {
    footer = {
      kind: "event",
      edgeLabel,
      iteration: colony.iteration,
      goldDiscarded: true,
    };
  } else if (goldNames) {
    footer = { kind: "chain", names: goldNames };
  } else if (chaosActive && edgeLabel) {
    footer = {
      kind: "event",
      edgeLabel,
      iteration: colony.iteration,
      goldDiscarded: false,
    };
  } else {
    footer = { kind: "empty" };
  }

  // STE-52: compact read-only top-candidate peek (AMEISENFABRIK-UI §8 Q2).
  const peek = topDecisionPeek(colony);
  const wahl: RailModel["wahl"] = peek
    ? {
        label: "Wahl",
        value: formatDecisionProbability(peek.probability),
        tone: "bone",
        compact: true,
        noteLines: [
          `${peek.fromName} → ${peek.toName}`,
          `Ameise ${String(peek.antId).padStart(2, "0")} · Hop ${peek.hop}/${peek.cityCount}`,
        ],
      }
    : {
        label: "Wahl",
        value: "—",
        tone: "bone",
        compact: true,
        noteLines: ["Top-Kandidat ruht", "Alle Ameisen zu Hause"],
      };

  return {
    rail: { besteTour, iteration, pheromon, gesperrt, wahl },
    footer,
    paramsLine: formatColonyParams(colony.params),
    chaosActive,
    goldDiscarded: !hasGold && chaosActive,
    blockedCount,
    eventEdgeLabel: edgeLabel,
  };
}

const EMPTY_HUD: HudView = {
  rail: {
    besteTour: {
      label: "Beste Tour",
      value: "—",
      tone: "gold",
      noteLines: ["—", "—"],
    },
    iteration: {
      label: "Iteration",
      value: "0",
      tone: "green",
      noteLines: ["—", "—"],
    },
    pheromon: {
      label: "Pheromon",
      value: "—",
      tone: "cyan",
      noteLines: ["—", "—"],
    },
    gesperrt: {
      label: "Gesperrt",
      value: "0",
      tone: "magenta",
      noteLines: ["Kanten gesperrt", "—"],
    },
    wahl: {
      label: "Wahl",
      value: "—",
      tone: "bone",
      compact: true,
      noteLines: ["—", "—"],
    },
  },
  footer: { kind: "empty" },
  paramsLine: formatColonyParams(DEFAULT_ACO_PARAMS),
  chaosActive: false,
  goldDiscarded: false,
  blockedCount: 0,
  eventEdgeLabel: null,
};


export function ColonyStage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ReturnType<typeof createColonyGraph3D> | null>(null);
  const colonyRef = useRef<Colony | null>(null);
  const crawlsRef = useRef<Crawl[]>([]);
  const rngRef = useRef(createRng(35));
  const playingRef = useRef(true);
  const historyRef = useRef<HudHistory>(initialHistory());
  const hudAccumRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [hud, setHud] = useState<HudView>(EMPTY_HUD);
  const [pickedEdge, setPickedEdge] = useState(() => edgeKey(0, 1));
  const options = useMemo(() => edgeOptions(AMEISEN_TSP_FIXTURE), []);

  const pushHud = useCallback((colony: Colony) => {
    const now = performance.now();
    historyRef.current = updateHistory(historyRef.current, colony, now);
    setHud(buildHud(colony, historyRef.current, now));
  }, []);

  const applyColony = useCallback(
    (next: Colony) => {
      colonyRef.current = next;
      pushHud(next);
    },
    [pushHud],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const graph = createColonyGraph3D(host);
    graphRef.current = graph;

    const rng = rngRef.current;
    const seeded = createColony(AMEISEN_TSP_FIXTURE, rng);
    const started = beginCrawls(seeded, rng);
    colonyRef.current = started.colony;
    crawlsRef.current = started.crawls;
    pushHud(started.colony);

    let frame = 0;
    let last = performance.now();

    const resize = () => {
      graph.resize();
    };

    const tick = (dt: number) => {
      const colony = colonyRef.current;
      if (!colony || !playingRef.current) {
        return;
      }
      const crawls = crawlsRef.current;
      let nextColony = colony;
      const nextCrawls = crawls.map((crawl) => ({ ...crawl }));

      for (let i = 0; i < nextCrawls.length; i++) {
        const crawl = nextCrawls[i]!;
        const antIndex = nextColony.ants.findIndex((ant) => ant.id === crawl.antId);
        if (antIndex < 0) {
          continue;
        }
        const edgeLen = graph.edgeWorldLength(crawl.from, crawl.to);
        crawl.progress += (ANT_SPEED_WORLD * dt) / edgeLen;
        if (crawl.progress < 1) {
          continue;
        }
        const ant = nextColony.ants[antIndex]!;
        if (isAntDone(ant, nextColony.cities.length)) {
          crawl.progress = 1;
          continue;
        }
        const hopFrom = ant.tour[ant.tour.length - 1]!;
        nextColony = stepAnt(nextColony, antIndex, rng);
        const hopTo = nextColony.ants[antIndex]!.tour.at(-1)!;
        crawl.from = hopFrom;
        crawl.to = hopTo;
        crawl.progress = 0;
      }

      if (allAntsDone(nextColony) && nextCrawls.every((crawl) => crawl.progress >= 1)) {
        const preCloseHistory = updateHistory(historyRef.current, nextColony, performance.now());
        historyRef.current = preCloseHistory;
        nextColony = closeIteration(nextColony, rng);
        const restarted = beginCrawls(nextColony, rng);
        colonyRef.current = restarted.colony;
        crawlsRef.current = restarted.crawls;
        pushHud(restarted.colony);
        hudAccumRef.current = 0;
        return;
      }

      colonyRef.current = nextColony;
      crawlsRef.current = nextCrawls;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (graph.consumeOrbitGesture()) {
        return;
      }
      const colony = colonyRef.current;
      if (!colony) {
        return;
      }
      const hit = graph.pickEdgeAt(event.clientX, event.clientY);
      if (!hit) {
        return;
      }
      setPickedEdge(edgeKey(hit[0], hit[1]));
      if (!colony.blockedEdges.has(edgeKey(hit[0], hit[1]))) {
        historyRef.current = {
          ...historyRef.current,
          massBeforeBlock: pheromoneTotalMass(colony),
        };
      }
      applyColony(toggleBlockedEdge(colony, hit[0], hit[1]));
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick(dt);
      const colony = colonyRef.current;
      if (colony) {
        graph.sync(colony, crawlsRef.current);
      }
      graph.render();

      hudAccumRef.current += dt;
      if (colony && hudAccumRef.current >= HUD_INTERVAL_S) {
        hudAccumRef.current = 0;
        pushHud(colony);
      }

      frame = requestAnimationFrame(loop);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    host.addEventListener("pointerup", onPointerUp);
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("pointerup", onPointerUp);
      graph.dispose();
      graphRef.current = null;
    };
  }, [applyColony, pushHud]);

  const onToggle = () => {
    const next = !playingRef.current;
    playingRef.current = next;
    setPlaying(next);
  };

  const onChaos = () => {
    const colony = colonyRef.current;
    if (!colony) {
      return;
    }
    historyRef.current = {
      ...historyRef.current,
      massBeforeBlock: pheromoneTotalMass(colony),
    };
    applyColony(injectChaos(colony));
  };

  const onFrei = () => {
    const colony = colonyRef.current;
    if (!colony) {
      return;
    }
    applyColony(clearBlockedEdges(colony));
  };

  const onTogglePicked = () => {
    const colony = colonyRef.current;
    if (!colony) {
      return;
    }
    const [a, b] = parseEdgeKey(pickedEdge);
    if (!colony.blockedEdges.has(pickedEdge)) {
      historyRef.current = {
        ...historyRef.current,
        massBeforeBlock: pheromoneTotalMass(colony),
      };
    }
    applyColony(toggleBlockedEdge(colony, a, b));
  };

  const subText =
    hud.goldDiscarded && hud.eventEdgeLabel
      ? `Kante ${hud.eventEdgeLabel} gesperrt. Sie lag auf der Gold-Tour, also ist Gold verworfen — die Kolonie läuft weiter und baut die beste gültige Tour neu auf.`
      : hud.chaosActive && hud.eventEdgeLabel
        ? `Kante ${hud.eventEdgeLabel} gesperrt. Die Kolonie meidet sie und hält die beste gültige Tour.`
        : SUB_CALM;

  return (
    <div className={styles.stage}>
      <header className={styles.mast}>
        <div>
          <p className={`${styles.kicker} ${hud.chaosActive ? styles.kickerHot : ""}`}>
            {hud.chaosActive ? "Demo #1 · chaos aktiv · no LLM" : "Demo #1 · chaos inject · no LLM"}
          </p>
          <p className={styles.story}>
            Software Factory · full-stack in ~2 days · DualAB-A façade · Origin→Vercel
          </p>
          <h1 className={styles.title}>Ameisenfabrik</h1>
          <p className={styles.sub}>{subText}</p>
        </div>
        <div className={styles.controls}>
          <button type="button" className={styles.toggle} aria-pressed={playing} onClick={onToggle}>
            {playing ? "Halt" : "Lauf"}
          </button>
          <button
            type="button"
            className={`${styles.chaos} ${hud.chaosActive ? styles.chaosHot : ""}`}
            onClick={onChaos}
          >
            Chaos
          </button>
          <button
            type="button"
            className={`${styles.frei} ${hud.blockedCount > 0 ? styles.freiOn : ""}`}
            onClick={onFrei}
            disabled={hud.blockedCount === 0}
          >
            Frei
          </button>
          <div className={styles.edgeControl}>
            <label className={styles.edgeLabel} htmlFor="ameisen-edge-pick">
              Kante
            </label>
            <select
              id="ameisen-edge-pick"
              className={styles.edgeSelect}
              value={pickedEdge}
              onChange={(event) => setPickedEdge(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="button" className={styles.edgeToggle} onClick={onTogglePicked}>
              Sperre / Frei
            </button>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <Rail model={hud.rail} />
        <div className={`${styles.frame} ${hud.chaosActive ? styles.frameAlert : ""}`}>
          <div ref={hostRef} className={styles.canvas} />
        </div>
      </div>

      <footer className={styles.foot}>
        <span>
          <span className={`${styles.swatch} ${styles.swatchTrail}`} />
          Pheromon
        </span>
        <span>
          <span className={`${styles.swatch} ${styles.swatchBest}`} />
          Beste Tour
        </span>
        <span>
          <span className={`${styles.swatch} ${styles.swatchBlocked}`} />
          Gesperrte Kante
        </span>
        <span className={styles.params} aria-label="Kolonie-Parameter">
          {hud.paramsLine}
        </span>
        {hud.footer.kind === "chain" ? (
          <span className={styles.chain}>
            Gold: <span className={styles.chainStrong}>{hud.footer.names.join(" › ")}</span>
          </span>
        ) : null}
        {hud.footer.kind === "event" ? (
          <span className={styles.event}>
            Iteration {hud.footer.iteration} · Kante{" "}
            <span className={styles.eventStrong}>{hud.footer.edgeLabel}</span> gesperrt
            {hud.footer.goldDiscarded ? " · Gold verworfen" : ""}
          </span>
        ) : null}
        <Link className={styles.homeLink} href="/">
          ← Factory
        </Link>
      </footer>
    </div>
  );
}
