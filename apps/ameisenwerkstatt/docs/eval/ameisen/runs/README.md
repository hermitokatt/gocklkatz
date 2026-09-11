# Runs

Dated sittings for the Ameisen tool-façade eval. The goldens under [`../goldens/`](../goldens/)
stay score-free; **this folder** is where Pass, notes and aggregates are recorded.

## Start a sitting

1. Copy [TEMPLATE.md](TEMPLATE.md) to `YYYY-MM-DD-<label>.md`. Do not overwrite the template.
2. Fill the metadata: UTC date, label, provider, model, scorer.
3. Walk G01–G07 using each golden's frozen prompt and its schema-and-refuse checkboxes.
4. Set **Pass** to `Y` or `N` only after scoring that golden; leave it blank until then.
5. Fill the aggregate only after the sitting, from the rows above it.

There is no checked-in pass rate until somebody has sat down and filled a sitting file. A rate that
was not computed from a run does not belong in this repository.
