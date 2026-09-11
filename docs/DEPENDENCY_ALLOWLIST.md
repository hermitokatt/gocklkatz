# Dependency allowlist

Single source of truth for direct dependencies across this monorepo. An app may add
further allowed packages in its own `docs/DEPENDENCY_ALLOWLIST.md`; that file is additive to
this list and may not contradict it.

## Version policy

- **Caret ranges are permitted** (`^x.y.z`). They express compatible upgrade headroom, not
  an exact pin.
- **Reproducibility comes from the lockfile plus `npm ci`.** The range in `package.json`
  selects what may be installed; the lockfile records what was installed. Do not describe a
  package as "pinned" unless its declared range is exact (no `^`, `~`, or `*` prefix).
- **Adding a package requires a ticket** and an update to this file (or the app-local
  allowlist) in the same commit.

## Scope

| Scope | May appear in | Meaning |
| --- | --- | --- |
| `runtime` | `dependencies` | Shipped to production or required at app runtime. |
| `dev` | `devDependencies` | Build, lint, typecheck, and unit-test toolchain only. |
| `test-only` | `devDependencies` | Browser drivers and other packages used only for served-app verification. Never in `dependencies`. |

A `test-only` entry in a runtime `dependencies` block is a guard failure.

## Packages

| Package | Declared range | Scope |
| --- | --- | --- |
| `next` | `^16.3.4` | runtime |
| `react` | `^19.2.8` | runtime |
| `react-dom` | `^19.2.8` | runtime |
| `zod` | `^4.5.4` | runtime |
| `three` | `^0.180.0` | runtime |
| `@types/node` | `^26.4.1` | dev |
| `@types/react` | `^19.2.18` | dev |
| `@types/react-dom` | `^19.2.7` | dev |
| `@types/three` | `^0.180.0` | dev |
| `typescript` | `^5.9.3` | dev |
| `eslint` | `^9.39.5` | dev |
| `eslint-config-next` | `^16.3.4` | dev |
| `eslint-config-prettier` | `^10.1.8` | dev |
| `prettier` | `^3.9.6` | dev |
| `vitest` | `^5.0.0` | dev |
| `vite` | `^8.2.2` | dev |
| `playwright` | `^1.0.0` | test-only |

**The declared-range column is informational and is not enforced.** The guard matches package
**names**; it does not compare a manifest's range against this table. The ranges record the
current state of the applications and are expected to move — when you bump a dependency, update
the row in the same commit.

`playwright` is approved for served-app verification but is not installed in this repository
until an app needs it.
