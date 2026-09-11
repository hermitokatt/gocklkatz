# Ameisenfabrik UI — design/quality brief (v1)

The design study behind the `/ameisen` layout. It was written before any UI code changed, and it is
kept as the record of what was decided and what was ruled out.

**Direction picked: A — Werkstatt**, on the design review of the draft pull request. §6 records the
choice and what it rules out; §7 is written for Werkstatt specifically rather than for four
hypothetical layouts. B, C and D stay in `docs/ameisen-ui-samples/` as the record of what was
rejected and why.

Read with: `docs/AMEISENFABRIK.md` (what was built), `app/ameisen/colony-stage.tsx` (the shipped
UI), `lib/ameisen/` (what the sim actually knows).

## 1. What “improve design and quality” means here

Ameisenfabrik is **creation theater**, not a polite SaaS dashboard. It runs in a room, on a big screen,
while somebody talks over it. That fixes the bar:

| Rule | Test |
| --- | --- |
| **Room test** | The hero number and the moving trail read from ~4 m. If a number needs squinting, it is not the hero. |
| **The stage is the product** | The graph gets the pixels. Chrome recedes: no box where a hairline works, no label where the thing can be labelled directly. |
| **Show the mechanism, not just the score** | An OR audience wants to see *why* an ant went there — τ, distance, resulting probability — not only the final tour length. |
| **Every pixel is traceable** | Each readout maps to a real field or an existing pure function over it. No invented metrics, no decorative fake telemetry. |
| **Events get punctuation** | Chaos, gold invalidated, gold rebuilt are *events*. They deserve a visible transient; a number silently changing is not theater. |
| **Quiet when nothing happens** | Between events the screen should be calm and legible, not blinking. Motion belongs to the ants and the trail. |

Prior art the rules are borrowed from — rewritten for this harness, not copied:
real-time flight-test display guidance (limit the persistent readouts, reserve color for meaning, keep the
refresh slow enough not to flicker), Tufte’s data-ink and “compared to what?”, agent-based-model
visualization guidance (pre-attentive channels — intensity and hue — for the pheromone field; redundant
encoding for the one thing that matters), and interactive ACO explainers (iteration-best vs global-best is
the pair that explains the algorithm).

**Quality**, in the non-visual sense, for whichever direction wins:

- Deterministic: seeded RNG stays the source of truth; no `Math.random()` in render code.
- No new dependencies. No charting library — series are hand-drawn SVG/canvas. Every direct
  dependency is on the monorepo allowlist at the repository root.
- 60 fps canvas: sim state stays in refs, React state is throttled (see §7), no layout thrash per frame.
- Numbers do not jitter: fixed decimals, tabular figures, stable column widths.
- Accessibility: keep the existing `aria-live="polite"` HUD region and the canvas `aria-label`; throttled
  updates also keep the screen reader usable.
- `bash scripts/ci.sh` green; new derived helpers are pure and unit-tested like the rest of `lib/ameisen`.

## 2. What the sim already knows

Everything below is on the client `Colony` today (`lib/ameisen/types.ts`), or is computed by a function
already exported from `lib/ameisen/index.ts`. Nothing new is invented.

| Field / function | Source | Shown today? |
| --- | --- | --- |
| `cities` (id, name, x, y) | `fixture.ts` | yes — nodes + labels; the 3D stage places them on a Fibonacci sphere for display only (ACO still uses `x,y`) |
| `tau[i][j]` | `pheromone.ts` | yes — line opacity/width only |
| `bestTour`, `bestLength` | `colony.ts` | yes — gold path, one number |
| `iteration` | `colony.ts` | yes |
| `blockedEdges` | `edges.ts` | yes — dashed edges + a count |
| `ants[].tour` (partial) | `colony.ts` | only as crawling triangles |
| `distances[i][j]`, `eta[i][j]` | `distance.ts` | **no** |
| `params` α, β, ρ, Q, τ₀, antCount | `params.ts` | **no** (only named in prose) |
| `pheromoneMass(tau)` | `pheromone.ts` | **no** — exported, unused by the UI |
| `maxPheromone(tau)` | `pheromone.ts` | internal, for normalisation only |
| `tourLength(tour, distances)` | `tour.ts` | **no** in the UI |
| `edgeWeight(τ, η, α, β)` | `choose.ts` | **no** — the actual decision rule |
| `isAntDone`, `antUnvisited`, `candidatesAvoidingBlocked` | `colony.ts`, `edges.ts` | **no** |
| `tourUsesBlockedEdge`, `pickChaosEdge`, `blockedEdgeCount` | `edges.ts` | count only |

## 3. Measured before proposing

Numbers below come from the code as it stood when this study was written (seed 37, defaults α 1,
β 5, ρ 0.45, Q 120, τ₀ 1, 10 ants, **10 cities**), read via `GET /api/ameisen/snapshot` /
`POST /api/ameisen/step` and a traced `runIteration` loop. They are also the data rendered in the
samples.

They are a record of that run, not of the current default. The live fixture was later reduced to
**5 cities** for the 3D walk graph, so re-running the same trace today produces different numbers.
What the measurements were used for — which readouts move and which are dead weight — still holds.

1. **The global best is flat.** Gold lands on **2650.4 in iteration 1** and is never beaten in 60
   iterations. A “best tour length over time” chart is a straight line — as a hero it is dead weight.
2. **The spread is alive.** In iteration 60 the ten ants score best **2650.4**, mean **2973.1**, worst
   **3707.1**. Iteration-best against the gold baseline is the series that actually moves.
3. **Convergence is visible in τ.** Share of pheromone mass sitting on the gold tour: **27 %** after
   iteration 1 → **66 %** by iteration 7 → **77 %** at iteration 60. Total mass collapses 56.8 → ~18.3 and
   then breathes around that level (evaporate ρ vs deposit Q/L).
4. **Chaos is the only thing that moves gold.** Blocking **Dock—Tor** (what `pickChaosEdge` picks: gold’s
   longest hop) at iteration 60 invalidates gold; the colony rebuilds **2763.1 (+112.7) in one iteration**,
   while **4 of 10** tours that iteration still close over the blocked edge and are discarded, and τ-on-gold
   dips 77 % → 74 %.
5. **The decision rule is the best story on the screen.** Real example from the chaos frame: ant 00 at
   **Guss**, hop 5/10, picks **Kran** with **p = 87.5 %** (τ 0.036, distance 852) over **Dock**
   (τ 0.000, distance 471, p ≈ 0 %). The short hop loses because the trail is dead there. That is ACO in one
   panel, and today the UI shows none of it.

## 4. Data to show, in priority order

Ranked for a room demo. Everything is either stored state or an existing pure function over it — the
“derived” rows add **no new sim math**.

| # | Readout | Why it earns the space | Source |
| --- | --- | --- | --- |
| 1 | **Best tour length** + since which iteration it has stood | The payoff number; “compared to what?” needs the age, since it rarely changes | `bestLength`, `iteration` (stored); age from UI-local history |
| 2 | **Iteration-best / mean / worst** of the current ten tours, against gold | The live signal — shows the colony searching, and the gap it is trying to close | derived: `tourLength(ant.tour, distances)` per ant, `tourUsesBlockedEdge` to drop invalid ones |
| 3 | **τ concentration** — share of pheromone mass on the gold tour (+ total mass) | The one honest convergence metric; explains *why* the ants stop wandering | derived: `pheromoneMass(tau)`, `tau` on gold edges |
| 4 | **Colony progress** — ants walking vs home, hop n/10 | Makes the iteration heartbeat and **Halt** legible; the canvas alone hides it | derived: `isAntDone`, `ant.tour.length` |
| 5 | **Chaos state** — blocked edges by city name, and whether gold was discarded | Turns the operator’s click into a stated consequence instead of a count | `blockedEdges` + `cities[]` names, `parseEdgeKey`, `bestTour === null` |
| 6 | **The decision rule** for one highlighted ant: candidates with τ, distance, resulting p | The mechanism made visible; the only readout that explains τ^α · η^β | derived: `antUnvisited`, `candidatesAvoidingBlocked`, `edgeWeight`, normalised |
| 7 | **Parameters, read-only** — α, β, ρ, Q, τ₀, ant count | Cheap credibility for an OR audience; also states that they are fixed here | `params` (stored) |

Deliberately **not** in the top seven: the raw τ matrix (the canvas already is the matrix), per-ant tour
history, and anything requiring state the sim does not keep.

## 5. Non-goals for the implementation ticket

- **No new knobs.** Keep exactly today’s controls: **Lauf / Halt**, **Chaos**, **Frei**, the **Kante**
  select, and click-an-edge on the canvas. α, β, ρ and ant count stay read-only in the UI; mutation already
  belongs to `POST /api/ameisen/params`.
- **No chat / LLM surface.** Tools stay on `POST /api/ameisen/tools`.
- **No new dependencies**, no charting library, no 3D, no WebGL.
- **No new sim math** in `app/`. Anything computed goes through the exported pure functions in `lib/ameisen`.
- **Nothing ships from this study.** This document plus the samples was the whole deliverable;
  implementation was a separate piece of work.

## 6. The four sample directions

Full-size images and captions: `docs/ameisen-ui-samples/README.md`.

| | Direction | Thesis | Emphasis | Main tradeoff |
| --- | --- | --- | --- | --- |
| **A** | **Werkstatt** | Today’s poster identity, reorganised | One hero gold number + four enamel plates on a left rail | Rail costs canvas width; still box-heavy |
| **B** | **Leitstand** | Instrument console | Maximum honest data: series, spread, ant roster, params | Reads as engineering, not theater; dense from 4 m |
| **C** | **Blaupause** | Quiet, high data-ink | Near-monochrome; gold is the only saturated colour; no boxes | Chaos feels understated; less spectacle |
| **D** | **Bühne** | Creation theater | Full-bleed stage, huge gold number, event banner, live τ^α · η^β decision panel | Overlays can occlude the graph; most work to get right |

### Picked: A — Werkstatt

The design review on the draft pull request chose **A**. What that settles:

- The **poster mast stays**: kicker, gradient wordmark, one sentence of prose, controls top-right.
- Readouts live in a **left rail of bordered plates**, one number each, not scattered over the stage.
- The canvas keeps its **frame** — no full-bleed stage, no floating overlays, so nothing occludes the graph.
- Therefore **no event banner** (D’s device) and **no decision panel** as drawn in D: the rail and the
  footer have to carry events. `docs/ameisen-ui-samples/sample-a2-werkstatt-chaos.png` shows that working —
  see §7.
- Readout 6 (τ^α · η^β decision table) has no home in the four-plate rail. It is **out for v1**
  unless the design review reopens it; §8 keeps the question open.

## 7. Implementation guide for Werkstatt (v1)

Reference renders: `sample-a-werkstatt.png` (calm) and `sample-a2-werkstatt-chaos.png` (the instant Chaos
lands). The `.html` beside each is the layout in real CSS — lift values from it rather than re-inventing them.

### Layout

Single page grid, `mast / body / foot`, 22px top and 18px bottom padding, `clamp` side padding as today:

- **Mast** — kicker, wordmark, one sentence, and the existing controls (**Halt**, **Chaos**, **Frei**)
  right-aligned. Unchanged from what ships, except the sentence becomes state-dependent (see below).
- **Body** — `336px` rail + fluid stage frame, 16px gap. The rail is four equal plates, 12px apart.
- **Foot** — legend (pheromone / best tour / blocked edge) on the left, and one right-aligned slot that
  holds the gold city chain normally and the event line when gold is discarded.

### What each plate shows

| Plate | Normal | When Chaos is active |
| --- | --- | --- |
| 1 · **Beste Tour** | readout 1 — gold value, note: unchanged since iteration *n*, best valid run this iteration | `—` in magenta, alert border, note: “Gold verworfen · die Sperre lag auf der Tour”, plus the last value and the iteration it died in |
| 2 · **Iteration** | readouts 4 — iteration count, note: ants walking, furthest ant’s hop | same |
| 3 · **Pheromon** | readout 3 — τ-on-gold share, note: total mass and peak | **falls back** to `Pheromon · Masse` with total mass, because the share has no referent while `bestTour` is `null`; note keeps the pre-block mass for comparison |
| 4 · **Gesperrt** | readout 5 — count (0), note carries readout 2, the spread of this iteration’s tours | count in magenta with an alert border, note names the edge by both city names and the iteration it was blocked in |

Plate 3’s fallback and plate 4’s two jobs are the only state-dependent content. Everything else keeps its
slot so the rail never reflows — a number that moves between plates is unreadable in a room.

### States the layout must handle

1. **Läuft, kein Chaos** — the calm reference render.
2. **Chaos gerade gesetzt** — gold discarded: no gold path on the canvas, plate 1 `—`, plate 3 on mass,
   plate 4 alert, footer shows the event line, **Frei** becomes enabled, **Chaos** picks up a glow.
3. **Erholt** — a new valid gold exists: everything returns to the normal column, plate 1 flashes once and
   its note reads what the recovery cost (`vor Chaos 2650.4 · +112.7 · neu in 1 Iteration`).
4. **Halt** — the canvas freezes; the rail keeps its last values and must stay legible (no dimming).

### File map

| File | Change |
| --- | --- |
| `lib/ameisen/readouts.ts` *(new)* | Pure selectors over `Colony`: iteration spread, τ-on-gold share, colony progress, blocked-edge names, decision table. Only calls existing exports. |
| `tests/ameisen-readouts.test.ts` *(new)* | Numeric assertions for each selector, in the style of `tests/ameisen.test.ts`. |
| `app/ameisen/rail.tsx` *(new)* | Presentational rail of four plates; props only, no sim logic. |
| `app/ameisen/colony-stage.tsx` | Keep the rAF loop and refs; feed the throttled snapshot to `<Rail />`. Controls unchanged. |
| `app/ameisen/ameisen.module.css` | Rail grid, plate + alert styles, footer event slot. The existing `.hud` flex row is replaced by the rail. |
| `lib/ameisen/index.ts` | Re-export the new selectors. |

### Render-loop rules (non-negotiable)

- Sim state stays in refs; the canvas keeps drawing every frame.
- HUD values go through **one throttled state update at ~8 Hz** (accumulate `dt` in the rAF loop), never
  one `setState` per frame — several of the new readouts change every frame.
- Events (gold invalidated, new gold, edge blocked/unblocked) push through immediately, outside the
  throttle, so the rail never lags the click.
- Derived values are computed in the throttle tick, not in render.
- Plate values use tabular figures and fixed decimals so a changing number never resizes its plate.

### Tokens already in the product (Werkstatt keeps all of them)

`#07060a` stage black · `#f4ead5` bone text · `#8a7f70` label grey · `#ffd000` gold (best tour) ·
`#19d7ff` cyan (pheromone) · `#ff3b00` / `#ff7a18` ant + city orange · `#ff3080` magenta (blocked) ·
`#9dff4a` green (live/ok). Colour stays semantic: gold only ever means best-so-far, magenta only ever
means blocked.

### Event punctuation

Werkstatt has no banner, so events are carried by the rail and the footer slot:

| Event | Detected from | Treatment |
| --- | --- | --- |
| Edge blocked | `blockedEdges` grew | Plate 4 takes the alert border and names both cities; the footer slot switches from the gold chain to the event line; the edge flashes on canvas |
| Gold discarded | `bestTour` became `null` | Plate 1 goes `—` in magenta with the alert border and a “verworfen” note; plate 3 falls back to total mass |
| Gold rebuilt / improved | `bestLength` decreased | One-shot flash on plate 1; its note records the iteration and the delta |
| Edges cleared (**Frei**) | `blockedEdges` emptied | Alert borders drop, footer returns to the gold chain |
| All ants home | `allAntsDone` | Brief tick on plate 2 — the colony heartbeat |

Alert borders persist while the condition holds; one-shot flashes last ~1.5 s. Both must be readable while
paused with **Halt**.

### Definition of done for the implementation

Werkstatt implemented behind no flag; readouts 1–5 present in the plates and footer per §7, readouts
6 and 7 out unless §8 is reopened; no new controls; all four states in §7 exercised; new selectors
unit-tested; `bash scripts/ci.sh` green; `bash scripts/verify.sh` green against the served page.

## 8. Open questions — smaller now that A is picked

1. **Readout 2 (the spread) is squatting.** In the render it lives as a note inside plate 4, which is the
   wrong plate for it. Move it to the footer next to the gold chain, give it a fifth plate, or drop it?
2. **Readout 6, the τ^α · η^β decision table.** Out for v1 as drawn — it needs a panel Werkstatt does not
   have. Worth a fifth plate showing only the top candidate and its probability, or leave it for later?
3. **Readout 7, the parameters.** Also unplaced: cheapest home is a quiet line in the footer
   (`α 1 · β 5 · ρ 0.45 · Q 120 · 10 Ameisen`). In or out?
4. German or English labels? The samples are German (`Beste Tour`, `Gesperrt`) to match `Lauf / Halt / Chaos / Frei`.
5. Fixed 16:9 stage for the room, or keep the fluid layout?
6. Should `prefers-reduced-motion` come back as a real requirement? It was dropped when the colony
   first shipped and is still unhandled.

None of these blocked the implementation: the defaults above (spread stays in plate 4’s note, 6 and 7 out,
German, fluid) were implementable as they stood.
