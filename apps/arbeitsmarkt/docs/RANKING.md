# Ranking model

The digest is produced by a late ranking stage over a filtered set of synthetic listings. The
stages are **collect → filter → rank → digest**. Ranking is not a search: it scores survivors of
the filter against a committed demonstration profile.

This is a **demonstration model** for the pipeline exhibit. It is not a validated ranking of real
vacancies, and it is not calibrated against hiring outcomes.

## Candidate profile

Committed at `data/profile.json`. Synthetic only — no real person, employer, or place.

| Field                                           | Purpose                                                      |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `preferredRoles`                                | Roles that score a full `role_match`                         |
| `preferredFocus`                                | Title-focus tokens that score a full `focus_match`           |
| `preferredDistricts`                            | Fictional district tokens that score a full `location_match` |
| `eligibility`                                   | Filter rules (see below)                                     |
| `scoring.weights`                               | Named component weights (sum to 1.0)                         |
| `scoring.recencyAnchor` / `recencyHalfLifeDays` | Fixed calendar anchor for the recency curve                  |
| `digestSize`                                    | How many ranked rows the digest view keeps                   |

## Filter

Listings that fail eligibility are rejected with an explicit reason. First matching rule wins.

| Reason code                 | Rule                                                        |
| --------------------------- | ----------------------------------------------------------- |
| `posted_before_eligibility` | `postedOn` is strictly before `eligibility.postedOnOrAfter` |
| `focus_excluded`            | Title focus is in `eligibility.excludedFocus`               |
| `role_excluded`             | Title role is in `eligibility.excludedRoles`                |

A filter that silently drops rows would hide the interesting part of this system. The digest view
lists every rejection and its reason.

## Score components

Each eligible listing receives a score in `[0, 1]` per component, then a weighted sum.

| Component        | Weight | Measurement                                                              |
| ---------------- | ------ | ------------------------------------------------------------------------ |
| `role_match`     | 0.40   | 1 if the title role is in `preferredRoles`, else 0                       |
| `focus_match`    | 0.35   | 1 if the title focus is in `preferredFocus`, else 0                      |
| `location_match` | 0.15   | 1 if the location district is in `preferredDistricts`, else 0            |
| `recency`        | 0.10   | `0.5^(daysAgo / recencyHalfLifeDays)` from `postedOn` to `recencyAnchor` |

Ties break by listing `id` ascending. The pipeline module under `lib/pipeline/` is pure: no DOM,
no `three`, no wall clock, no `process.env`.

## Provenance

Scores are computed in-process from the committed dataset and profile. There is no acquisition
path and no live listing fetch.
