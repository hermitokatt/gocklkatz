# 005 — Add the Arbeitsmarkt demo

**Linear:** `GOC-9`

**Status: draft.** Scope is agreed; the frozen requirement is not written yet. This one carries a
constraint the others do not, so read the next section before assuming it is a normal build.

## Plain English

Arbeitsmarkt demonstrates a job-listing pipeline: it collects IT and software roles from public
sources, filters and ranks them against a candidate profile, and produces a short relevance-ranked
digest. It is a working pipeline with real operational discipline — request budgets, robots.txt
compliance, retention windows, and alarms.

## The constraint that shapes this demo

**The pipeline collects third-party data, and none of it may be published.**

Publishing scraped listings, or the personal profile they are ranked against, is out of scope here
for legal and terms-of-service reasons — several of the sources the pipeline can read have terms
that prohibit automated collection or republication, and one is deliberately disabled for exactly
that reason.

Therefore the demo presents the **system**, not harvested data:

* the stored data is **synthetic**, generated from a checked-in seed, and clearly labelled as
  synthetic on the page;
* no real listing, raw page, digest or candidate profile is ever committed or served;
* the compliance design is part of the exhibit — the request budget, the robots handling and the
  attribution rules are the interesting engineering, and they are safe to show.

That constraint is what makes this demo worth building. A job board would be unremarkable; a
pipeline whose compliance rules are enforced by code and demonstrable is the story.

## Known scope

* A web surface at `apps/arbeitsmarkt` presenting: what the pipeline does, the ranking stages, and
  a rendered digest built from synthetic data.
* Same requirements as every demo: own `package.json` and lockfile, `scripts/ci.sh`,
  `scripts/verify.sh`, a `repo.config` entry, a Vercel project, and a landing-page card flipped to
  `live` only once its URL returns 200.
* The generator for the synthetic dataset is committed alongside the demo, so the data is
  reproducible rather than a mystery blob.

## To be decided before freezing

* Whether the pipeline runs on a schedule to produce the demo's data, or whether the dataset is
  generated at build time. The second is simpler and removes any live collection from the deploy.
* Whether the demo includes an interface for the operational view — source health and the alarms —
  or only the digest.
* The measured claims the card will carry. They must be reproducible from a committed command.
