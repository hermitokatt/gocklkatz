# G01 — Happy path: getBestTour

## Intent

Model calls allowlisted `getBestTour` (optionally after `step`) and returns a schema-valid best-tour payload.

## Prompt (frozen)

```
You may only use ameisen tools: getTrail, getBestTour, setParams, step.
Read the colony's best-so-far tour via the typed tool. Do not invent tools.
```

## Expected tool use

1. Optional: `{ "tool": "step", "args": { "iterations": 1 } }` (or more)
2. Required: `{ "tool": "getBestTour", "args": {} }`

## Schema / refuse checks (score these)

- [ ] Tool name is exactly `getBestTour` (allowlisted)
- [ ] Result parses as `{ bestTour, bestLength, iteration }`
- [ ] No non-allowlisted tool names appear

## Pass

_(Do not fill. Record Pass in a dated run under `../runs/`.)_
