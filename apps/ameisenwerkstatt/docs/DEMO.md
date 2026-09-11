# Ameisenfabrik — room demo (5–8 min)

Click-through script for the live Werkstatt UI on `/ameisen`. The source of truth is this file plus
the page itself (`app/ameisen/`). No LLM, no chat surface — pure ACO theatre.

## Before the room

Node **22+**. From `apps/ameisenwerkstatt`:

```bash
npm ci
npm run dev
```

Open **http://localhost:43123/** (the card) then **Enter the Werkstatt**, or go straight to
**http://localhost:43123/ameisen** on the big screen. Leave it running; the page starts in **Lauf**
(the top-right button already reads **Halt**).

Optional smoke, not part of the talk: `GET http://localhost:43123/api/health` →
`{ "ok": true, "service": "demo-shell" }`.

## What the audience should already see (calm)

| Zone | What is on screen |
| --- | --- |
| **Mast** | Kicker `Ameisenwerkstatt · chaos inject · no LLM`, a green one-liner, the gradient wordmark **Ameisenfabrik**, and one German sentence about the 5-city TSP on its orbit sphere and **τ^α · η^β** |
| **Controls** (top-right) | **Halt** / **Lauf**, **Chaos**, **Frei** (disabled while nothing is blocked), the **Kante** select and **Sperre / Frei** |
| **Left rail** — five plates | **Beste Tour** (gold length), **Iteration** (count + ants walking), **Pheromon** (share of trail mass on the gold tour), **Gesperrt** (`0`), **Wahl** (the top candidate's probability for one highlighted ant) |
| **Stage** | Cyan pheromone field, orange city nodes carrying workshop names, crawling ants, the gold best-so-far tour |
| **Footer** | Legend (Pheromon / Beste Tour / Gesperrte Kante), the read-only parameter line, and the `Gold: City › City › …` chain when a best tour exists |

Point at the stage first, then the rail. The graph is the product; the plates are the scoreboard.

---

## Timed beats

Aim for **~6 minutes**. Cut the **Kante** beat if you are short of time; keep
**Chaos → recover → Frei**.

### 0:00–0:45 — Open

**Do:** nothing. Let the ants crawl for a few seconds.

**Say:**

> This is Ameisenfabrik — living ant-colony optimization on a fixed five-city travelling-salesman
> problem, drawn on a sphere you can orbit. Classic ACO weight, **tau to the alpha times eta to the
> beta**. No LLM. What you see is the colony searching.

**Point:** cyan trails are pheromone intensity; the gold ring is the best-so-far tour; the orange
triangles are ants.

### 0:45–1:45 — Scoreboard (five plates)

**Do:** glance left; optionally hit **Halt** once so the numbers freeze, then **Lauf** again.

**Say, plate by plate:**

1. **Beste Tour** — the payoff length. The note under it says how long that record has stood, plus
   this iteration's best valid run.
2. **Iteration** — the colony heartbeat: how many ants are still walking, and the furthest hop.
3. **Pheromon** — the share of pheromone mass sitting on the gold tour. That is the honest
   convergence signal, and the cyan on the canvas is the same field.
4. **Gesperrt** — the blocked-edge count, still `0`. Its second note shows the spread of this
   iteration's tours.
5. **Wahl** — one ant's actual next-step decision: the top candidate and its probability. That is
   τ^α · η^β made visible.

**Say:** gold often lands early and then sits. The colony keeps searching — watch Iteration and the
ant crawl, not only the gold number.

### 1:45–2:30 — Halt / Lauf

**Do:** click **Halt**. Wait about three seconds. Click **Lauf**.

**See:** the canvas freezes; the rail stays fully lit, with no dimming. **Halt** toggles to **Lauf**
and back.

**Say:**

> Operator pause. The math stops; the scoreboard stays readable from the back row.

### 2:30–4:00 — Chaos (the money beat)

**Do:** wait until a gold tour is visible on the stage and the footer shows the `Gold: …` chain.
Click **Chaos** once.

**What Chaos does:** it blocks the longest unblocked hop on the current gold tour. That edge goes
dashed magenta with a cut mark.

**See immediately:**

| Cue | Change |
| --- | --- |
| Kicker | `Ameisenwerkstatt · chaos aktiv · no LLM` |
| Subline | Names the blocked Kante; says gold was discarded because the cut lay on the tour |
| **Chaos** button | Magenta glow |
| **Frei** | Enabled |
| Stage frame | Alert tint; the gold path is **gone** |
| Plate **Beste Tour** | `—` in magenta, alert border, "Gold verworfen · die Sperre lag auf der Tour" plus the last value |
| Plate **Pheromon** | Label flips to **Pheromon · Masse** — the share has no referent without a gold tour |
| Plate **Gesperrt** | Count `1`, alert border, names the edge and the iteration |
| Footer | Event line: `Iteration N · Kante X–Y gesperrt · Gold verworfen` |

**Say:**

> Chaos cuts an edge on the gold tour. Best-so-far is invalid — the plate goes to a dash, not a
> quiet number change. The ants cannot use the cut. The colony keeps running and has to earn a new
> valid best.

Let **one full iteration** close after the click so the audience sees the recovery.

**See on recovery:**

- The gold path returns on the canvas, on a different route.
- **Beste Tour** gets a real length again, and flashes once.
- Its note reads what the recovery cost: `vor Chaos … · ±… · neu in N Iteration`.
- **Pheromon** returns to the share-on-gold readout.
- The footer returns to the `Gold: …` chain while the block remains.

**Say:**

> New gold, usually a bit longer. That delta is the cost of the cut — an OR audience cares about the
> recovery, not just the break.

### 4:00–5:00 — Frei

**Do:** click **Frei**.

**See:** the magenta dashed edge clears; alert borders drop; **Frei** disables again; the kicker
returns to `chaos inject`; the subline returns to the calm sentence; **Gesperrt** goes back to `0`.
Gold stays, because it was already valid.

**Say:**

> Frei clears every block. Same colony, open graph again.

### 5:00–6:30 — Optional: pick a Kante (or click the canvas)

Use this if you still have time; otherwise skip and close.

**Do**, either:

1. **Kante** select → choose a named edge → **Sperre / Frei**, or
2. click near an edge on the canvas, avoiding the city nodes.

**See:** the same punctuation family as Chaos. If the edge was **not** on gold, Beste Tour may stay;
if it **was**, you get another discard-and-recover story.

**Say:**

> Chaos is the one-click spectacle. Kante and the canvas click are the operator's dial — same rules,
> your choice of edge.

Toggle **Sperre / Frei**, or hit **Frei**, to clean up before questions.

### 6:30–8:00 — Close / buffer

**Do:** leave **Lauf** on. Optionally **Halt** for a static poster during questions.

**Say:**

> The split in one line: this stage is the simulation — colony, chaos, typed HTTP. A model talks to
> it only through an allowlist of four tools (`getTrail`, `getBestTour`, `setParams`, `step`). No
> model is hard-locked in the app, and nothing here calls one.

**Point at the docs if asked:** `docs/AMEISENFABRIK.md` (what was built),
`docs/AMEISENFABRIK-UI.md` (the Werkstatt design), and this script.

---

## Operator cheat sheet

| Control | Effect |
| --- | --- |
| **Halt** / **Lauf** | Pause / resume the requestAnimationFrame colony loop |
| **Chaos** | Block gold's longest hop, or the longest open edge if there is no gold |
| **Frei** | Clear all blocked edges (disabled when the count is 0) |
| **Kante** + **Sperre / Frei** | Toggle the selected undirected edge by city names |
| Canvas click | Toggle the nearest edge; hits on cities are ignored |

| Plate | Calm | After gold-cutting Chaos |
| --- | --- | --- |
| **Beste Tour** | Gold length | `—` plus a "verworfen" note |
| **Iteration** | Count + walking ants | Same; a heartbeat tick when all ants are home |
| **Pheromon** | Share on gold | Falls back to **Pheromon · Masse** |
| **Gesperrt** | `0` + the tour spread note | Count + the named edge, alert |
| **Wahl** | Top candidate and its probability | Same |

## Don't

- Don't open `/api/ameisen/*` in the room talk — stay on the stage.
- Don't promise a moving gold chart; gold is often flat until Chaos.
- Don't start Chaos before a gold path is visible — the discard story needs a tour to cut.
- If the page and this script disagree, trust the page and fix the script.

## Related

- What was built: `docs/AMEISENFABRIK.md`
- Werkstatt layout: `docs/AMEISENFABRIK-UI.md`
- Design samples, including the rejected directions: `docs/ameisen-ui-samples/`
