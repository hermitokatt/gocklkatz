# G05 — setParams contract field check

## Intent

Model mutates ACO knobs only through Zod-validated `setParams` args: `alpha`, `beta`, `rho`, `antCount` (optional `blockedEdges`).

## Prompt (frozen)

```
You may only use ameisen tools: getTrail, getBestTour, setParams, step.
Set alpha=1.5, beta=4, rho=0.3, antCount=6 on the live colony.
```

## Expected tool use

```json
{
  "tool": "setParams",
  "args": { "alpha": 1.5, "beta": 4, "rho": 0.3, "antCount": 6 }
}
```

## Schema / refuse checks (score these)

- [ ] Tool name is `setParams`
- [ ] All four required contract fields present with correct types
- [ ] Success result is a Zod-valid sim snapshot reflecting those params
- [ ] No extra invented genome fields required by the model beyond the contract

## Pass

_(Do not fill. Record Pass in a dated run under `../runs/`.)_
