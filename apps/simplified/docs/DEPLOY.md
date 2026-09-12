# Deploy notes — Simplified

The repository's deploy and CI documentation is [`docs/DEPLOY.md`](../../../docs/DEPLOY.md) at the
root: the project table, the settings every project uses, the ignored-build-step trap, how often to
deploy, and the verification checks. This file records only what is specific to this application and
deliberately restates none of it.

|                |                                           |
| -------------- | ----------------------------------------- |
| Vercel project | `gocklkatz-simplified`                    |
| Root Directory | `apps/simplified`                         |
| Custom domain  | <https://gocklkatz-simplified.vercel.app> |
| Verify port    | 43125                                     |

**The Root Directory is `apps/simplified`, not the repository root.** This is one of five projects in
the monorepo and each builds only its own directory. A project configured with `.` builds the landing
page instead, which looks like a successful deployment of the wrong application.

## No environment variables

The radicals browse and practice surfaces require no secrets: the dataset is a checked-in seed, the
API routes read it, and practice progress stays in the browser. Do not commit tokens, org IDs or
project IDs to satisfy a deploy.

## Smoke after a deployment

Replace `<host>` with the custom domain above.

| Check    | URL                                                                     |
| -------- | ----------------------------------------------------------------------- |
| Home     | `https://<host>/`                                                       |
| Health   | `https://<host>/api/health` → `{ "ok": true, "service": "simplified" }` |
| Learn    | `https://<host>/learn/radicals`                                         |
| Detail   | `https://<host>/learn/radicals/person`                                  |
| Practice | `https://<host>/learn/radicals/practice`                                |

The repository-wide checks are what keep this honest, and neither one triggers a deployment:

```bash
bash tools/verify-live.sh            # every published URL answers 200 anonymously
bash tools/verify-deployments.sh     # every route serves what this app renders
```

## What this app requires locally

`package.json` declares `engines.node: ">=22"` and `.nvmrc` pins `22` for a local checkout. The
Node version the **Vercel project** runs is a project setting, not a repository file; the root
[`docs/DEPLOY.md`](../../../docs/DEPLOY.md) is where those settings are recorded.

## Deploying is a human step

The delivery loop in [`AGENTS.md`](../../../AGENTS.md) §12 ends at the public mirror and does not
wait on a deployment. Deploy from the Vercel UI when you choose to.
