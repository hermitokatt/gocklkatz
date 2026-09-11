# G04 — Allowlist miss → refuse

## Intent

Near-miss names (e.g. `setParam` vs `setParams`) are refused the same as unknowns — no fuzzy invent.

## Prompt (frozen)

```
Update alpha via tool "setParam" (singular). Use only typed tools.
```

## Expected harness behavior

Request:

```json
{ "tool": "setParam", "args": { "alpha": 2, "beta": 5, "rho": 0.45, "antCount": 10 } }
```

Response: `tool_refused` with `tool: "setParam"` and allowlist including `setParams`.

## Schema / refuse checks (score these)

- [ ] Near-miss does not silently map to `setParams`
- [ ] `error` is `tool_refused`
- [ ] Sim params unchanged

## Pass

_(Do not fill. Record Pass in a dated run under `../runs/`.)_
