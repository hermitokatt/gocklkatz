# Ameisen tool-façade eval

Frozen goldens for scoring **tool use plus schema and refusal behaviour**, not prose fluency.

The folder contract — goldens versus dated runs, and why the two are separate —
is in [`../README.md`](../README.md).

The application is provider-neutral: a model name belongs only in a **dated run**, as metadata. It
is not hard-locked anywhere in the code.

## Allowlist (the application is the source of truth)

| Tool          | Maps to                                    |
| ------------- | ------------------------------------------ |
| `getTrail`    | Snapshot trail fields (`tau`, …)           |
| `getBestTour` | Best-so-far from the shared colony         |
| `setParams`   | `POST /api/ameisen/params` / `applyParams` |
| `step`        | `POST /api/ameisen/step` / `advanceSteps`  |

HTTP entry point: `POST /api/ameisen/tools` with body `{ "tool": "<name>", "args": … }`. The
allowlist itself lives in `lib/ameisen/tool-schemas.ts`.

Any other tool name returns `{ "error": "tool_refused", … }` — a clear refusal, never a silent
guess at what was meant.

These routes are behind the mutate gate (`lib/ameisen/mutate-gate.ts`). A sitting against a
deployed instance needs `AMEISEN_MUTATE_SECRET` set and the `Authorization: Bearer` header on every
call; against a local run, set it in `.env.local`.

## Goldens (frozen — no scores)

| ID  | File                                                                                 | Shape scored                 |
| --- | ------------------------------------------------------------------------------------ | ---------------------------- |
| G01 | [goldens/G01-happy-getBestTour.md](goldens/G01-happy-getBestTour.md)                 | Happy tool path              |
| G02 | [goldens/G02-happy-step.md](goldens/G02-happy-step.md)                               | Happy tool path              |
| G03 | [goldens/G03-unknown-tool-refuse.md](goldens/G03-unknown-tool-refuse.md)             | Unknown name → refuse        |
| G04 | [goldens/G04-allowlist-miss-refuse.md](goldens/G04-allowlist-miss-refuse.md)         | Near miss → refuse           |
| G05 | [goldens/G05-setParams-contract-fields.md](goldens/G05-setParams-contract-fields.md) | Contract field check         |
| G06 | [goldens/G06-error-shape-validation.md](goldens/G06-error-shape-validation.md)       | Error shape                  |
| G07 | [goldens/G07-invalid-params-no-write.md](goldens/G07-invalid-params-no-write.md)     | Invalid params write nothing |

Scores live only in dated run files under [`runs/`](runs/).

`GET /api/health` is not a golden here.

## Runs (dated sittings)

Copy [`runs/TEMPLATE.md`](runs/TEMPLATE.md) to `runs/YYYY-MM-DD-<label>.md` for each sitting and
fill the model metadata and Pass columns there. See [`runs/README.md`](runs/README.md).
