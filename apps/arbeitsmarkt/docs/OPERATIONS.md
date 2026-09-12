# Operations model

This document describes the **demonstration** operational policy for the Arbeitsmarkt exhibit:
source compliance, request budgets, failure back-off, quarantine, and alarms. It is not a
production incident process.

The snapshot is computed by a pure module (`lib/pipeline/operations.ts`) from the committed
registry (`data/sources.json`) and the committed synthetic dataset. No clock, no environment, no
network.

## Synthetic sources

Sources are fictional, in the same spirit as the invented employers and districts. Display names
follow:

```
displayName = "SRC-" + Prefix + Middle + Suffix
```

Example: `SRC-VexalynFeed`. The construction and word-part meanings are recorded in the registry
`legend`. No real job board, API, or company is named.

## Compliance status (enforced in code)

| Status        | Meaning                                                                           | Enforcement                                    |
| ------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| `permitted`   | On the demonstration allowlist. Collection may be scheduled.                      | `isCollectionAllowed` returns `true`           |
| `disabled`    | Marked disabled in the registry. Collection is not attempted.                     | `isCollectionAllowed` returns `false`          |
| `quarantined` | Derived: a permitted source crossed the consecutive-failure quarantine threshold. | Set by `applyFailurePolicy` / `evaluateSource` |

`isCollectionAllowed` in `lib/pipeline/operations.ts` is the compliance gate. Disabled sources
never receive attempts in the committed registry; the `disabled_source_collected` alarm would fire
if they did.

## Request budget

Each source has a request budget with an explicit window:

| Field     | Value                                            |
| --------- | ------------------------------------------------ |
| Window    | `rolling_24h_ending_at_anchor`                   |
| Anchor    | `meta.anchorAt` in `data/sources.json`           |
| Consumed  | Count of attempts whose `at` falls in the window |
| Remaining | `max(0, limit - consumed)`                       |

The window is stated on the operations view, not implied.

## Failure policy (demonstration)

Attempt outcomes:

| Outcome             | Meaning                                               |
| ------------------- | ----------------------------------------------------- |
| `success`           | Synthetic successful response                         |
| `transport_failure` | Synthetic transport failure (no HTTP status)          |
| `refused_403`       | Synthetic refused response (HTTP 403) — distinct case |

Consecutive failures (transport or refused) drive operational state:

| Condition                                                                          | Result        | System action                                                                          |
| ---------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------- |
| Consecutive failures ≥ `consecutiveFailuresBeforeBackoff` (2) and below quarantine | `backed_off`  | Defer further attempts until `lastFailureAt + backoffIntervalMinutes` (120)            |
| Consecutive failures ≥ `consecutiveFailuresBeforeQuarantine` (3)                   | `quarantined` | Stop scheduling; record a quarantine reason (403 noted when the streak ends on refuse) |
| Otherwise, with recent success                                                     | `healthy`     | Continue under budget                                                                  |
| Disabled compliance                                                                | `idle`        | No collection                                                                          |

A source that returns 403 is recorded as `refused_403`. After enough consecutive failures it is
backed off and then quarantined; the operations view shows that state rather than hiding it.

**This is a demonstration policy, not a production incident process.**

## Alarms

Each alarm has an id, a human description, a severity, and a state (`firing` or `clear`).

| Id                          | Fires when                               |
| --------------------------- | ---------------------------------------- |
| `source_quarantined`        | Any source is operationally quarantined  |
| `source_backed_off`         | Any source is in back-off                |
| `budget_exhausted`          | Any source has `remaining === 0`         |
| `disabled_source_collected` | A disabled source has a recorded attempt |

The committed registry is arranged so at least one alarm fires and at least one is clear.

## Provenance

Health timestamps, budget consumption, quarantine, and alarm states are **derived** from the
attempt records in `data/sources.json`. Changing those records changes the snapshot. There is no
acquisition path and no live source fetch.
