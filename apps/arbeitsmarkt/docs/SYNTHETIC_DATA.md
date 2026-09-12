# Synthetic data model

This app does not acquire third-party job listings. The dataset under `data/listings.json` is
generated offline from a numeric seed and committed with the app.

## Seed and reproducibility

| Field               | Value                                                                |
| ------------------- | -------------------------------------------------------------------- |
| Default seed        | `28` (`DEFAULT_SEED` in `lib/dataset/parts.ts`)                      |
| Schema version      | `1`                                                                  |
| Record count        | `24`                                                                 |
| Posting-date window | `2024-01-01` … `2024-06-30` (fixed; not derived from the wall clock) |

`generateDataset(seed)` in `lib/dataset/generate.ts` uses Mulberry32 (`createRng`) — the same
family of seeded RNG as Bienenstock. `Math.random`, `Date.now`, `new Date()`, `performance.now` and
`process.env` are forbidden in every generator module — asserted across `generate.ts`, `rng.ts`,
`parts.ts` and `index.ts`, not only the file that holds the entry point. `new Date(ms)` from a fixed
timestamp is permitted; it is the no-argument form that reads the clock.

Same seed → same JSON bytes when passed through `serializeDataset`.

A Vitest suite asserts:

1. two generations with the same seed are byte-identical;
2. the committed `data/listings.json` equals a fresh generation;
3. every record has `synthetic: true`, and a synthetic-only filter returns every record.

## Naming construction

Company names are mechanical and deliberately unnatural:

```
companyName = "SYN-" + Prefix + Middle + Suffix
```

Example: `SYN-VexalynTek` from prefix `Vex`, middle `alyn`, suffix `Tek`.

Locations are fictional districts only:

```
location = District + " " + Zone
```

Example: `Northgrid Sector`.

Source display names in `data/sources.json` follow a sibling construction so listing hosts stay
obviously invented too — no real job board or API is named:

```
displayName = "SRC-" + Prefix + Middle + Suffix
```

Example: `SRC-VexalynFeed`. Source ids use `syn-src-NNNN`. The source legend lives in the registry
file; the operations view surfaces the construction.

The word-part lists live in `lib/dataset/parts.ts` and are copied into the dataset's `legend`
with a plain-language meaning for each token. A reader can open the JSON and see that no real
employer or real place is named.

## Dataset shape

```json
{
  "meta": {
    "schemaVersion": 1,
    "seed": 28,
    "synthetic": true,
    "statement": "All records in this dataset are synthetic. …",
    "dateWindow": { "startInclusive": "2024-01-01", "endInclusive": "2024-06-30", "dayCountInclusive": 182 },
    "recordCount": 24
  },
  "legend": { "construction": "…", "prefixes": […], "middles": […], "suffixes": […], "locationDistricts": […], "locationZones": […] },
  "records": [
    {
      "id": "syn-0001",
      "synthetic": true,
      "companyName": "SYN-…",
      "companyParts": { "prefix": "…", "middle": "…", "suffix": "…" },
      "title": "…",
      "location": "…",
      "postedOn": "2024-…"
    }
  ]
}
```

The per-record `synthetic` field is structural: any consumer that selects records still carries
the flag. The UI statement on `/arbeitsmarkt` is additional disclosure, not a substitute for it.
