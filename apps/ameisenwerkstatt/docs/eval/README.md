# Eval docs

Home for the frozen goldens that score a model driving this application's tool façade, and for the
dated sittings in which someone actually scores them.

## Folder contract

| Path | Role | Holds scores? |
| ---- | ---- | ------------- |
| [`ameisen/goldens/`](ameisen/goldens/) | The tool goldens, G01–G07 | **No** — the Pass column stays blank |
| [`ameisen/runs/`](ameisen/runs/) | Dated sittings, copied from the template | **Yes** — this is the only place a Pass is recorded |
| [`ameisen/runs/TEMPLATE.md`](ameisen/runs/TEMPLATE.md) | The blank sitting form | Blank until copied |

### Why goldens never hold scores

A golden is the question. A run is one answer to it, on one date, with one model. Writing a score
back into the golden destroys the question: the next reader cannot tell whether the bank was frozen
before or after the result was known, and a pass rate with no run behind it is a number without
provenance.

So: fixed IDs, frozen prompts, and expected checks live in the bank. Pass, notes, and any aggregate
live in a dated copy. A pass rate that nobody sat down and computed does not get written anywhere.

### Dated runs

Copy [`ameisen/runs/TEMPLATE.md`](ameisen/runs/TEMPLATE.md) to
`ameisen/runs/YYYY-MM-DD-<label>.md` before a sitting, and fill it in there.

The provider and model belong in that run's metadata only. Nothing in the application hard-locks a
model name, and the goldens must stay usable against any of them.

## Suites

| Suite | Path | Notes |
| ----- | ---- | ----- |
| Ameisen tool façade | [`ameisen/`](ameisen/) | G01–G07, plus [`runs/TEMPLATE.md`](ameisen/runs/TEMPLATE.md) |

## First sitting

1. Read [`ameisen/README.md`](ameisen/README.md) and the seven goldens under
   [`ameisen/goldens/`](ameisen/goldens/).
2. Copy `ameisen/runs/TEMPLATE.md` to `ameisen/runs/YYYY-MM-DD-<label>.md`.
3. Fill the metadata: date, label, provider, model, scorer.
4. Score each golden's tool, schema and refuse checks. Leave Pass blank until that golden is scored.
5. Fill the aggregate only after scoring.

`GET /api/health` is not an eval golden. It is covered by `tests/health.test.ts` and by
`scripts/verify.sh`.
