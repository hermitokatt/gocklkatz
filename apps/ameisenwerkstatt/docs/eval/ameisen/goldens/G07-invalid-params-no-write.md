# G07 — Invalid params write nothing

## Intent

Out-of-contract genome (e.g. negative `alpha`) is rejected by Zod; shared sim state is byte-identical to before the call.

## Prompt (frozen)

```
Set alpha to -1 via setParams (keep beta=5, rho=0.45, antCount=10).
```

## Expected harness behavior

Request:

```json
{
  "tool": "setParams",
  "args": { "alpha": -1, "beta": 5, "rho": 0.45, "antCount": 10 }
}
```

Response: `validation_failed` with issues. Snapshot before === snapshot after.

## Schema / refuse checks (score these)

- [ ] Call does not succeed
- [ ] Error is `validation_failed`
- [ ] `getTrail` / snapshot after matches pre-call state (no partial write)

## Pass

_(Do not fill. Record Pass in a dated run under `../runs/`.)_
