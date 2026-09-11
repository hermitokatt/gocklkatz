# G02 — Happy path: step

## Intent

Model advances the live colony with allowlisted `step` and receives a typed step result.

## Prompt (frozen)

```
You may only use ameisen tools: getTrail, getBestTour, setParams, step.
Advance the colony by exactly 2 ACO iterations using the typed step tool.
```

## Expected tool use

1. `{ "tool": "step", "args": { "iterations": 2 } }`

## Schema / refuse checks (score these)

- [ ] Tool name is exactly `step`
- [ ] Args include positive integer `iterations` (here: 2)
- [ ] Result has `iterationsAdvanced` and a Zod-valid `snapshot`
- [ ] No invented tool names

## Pass

_(Do not fill. Record Pass in a dated run under `../runs/`.)_
