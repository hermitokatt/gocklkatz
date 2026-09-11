# G06 — Error shape: validation_failed

## Intent

Invalid args on an allowlisted tool return the frozen error shape, not a prose apology or invented error codes.

## Prompt (frozen)

```
Call step with iterations=0.
```

## Expected harness behavior

Request:

```json
{ "tool": "step", "args": { "iterations": 0 } }
```

Response (shape):

```json
{
  "error": "validation_failed",
  "issues": [{ "path": "iterations", "message": "..." }]
}
```

## Schema / refuse checks (score these)

- [ ] `error` is exactly `validation_failed` (not `tool_refused`)
- [ ] `issues` is a non-empty array of `{ path, message }`
- [ ] Iteration counter on the colony is unchanged

## Pass

_(Do not fill. Record Pass in a dated run under `../runs/`.)_
