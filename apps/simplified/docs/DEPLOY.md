# Deploy Simplified on Vercel

MVP deploy notes for connecting this Next.js App Router repo to **Vercel**. No environment secrets are required for the radicals browse + practice MVP (health API, radicals API, and client-local practice progress).

## Prerequisites

- A Vercel account with permission to create a project
- Access to this Git repository (import via Vercel Git integration)
- **Node.js 22+** locally if you verify the build before deploy (`package.json` `engines.node`)

## Connect the repo

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → **Add New…** → **Project**.
2. Import this Git repository.
3. Confirm framework settings (Vercel usually auto-detects Next.js):

| Setting          | Value                                                   |
| ---------------- | ------------------------------------------------------- |
| Framework Preset | **Next.js**                                             |
| Node.js Version  | **22.x** (Project Settings → General → Node.js Version) |
| Build Command    | `next build` (default for Next.js)                      |
| Output Directory | leave default (Next.js handles this)                    |
| Install Command  | `npm install` (default)                                 |
| Root Directory   | `.` (repo root)                                         |

4. **Environment Variables:** leave empty for MVP. Do **not** commit tokens, org IDs, or project IDs to the repo.
5. Click **Deploy**.

After the first production deploy succeeds, copy the production URL into [`README.md`](../README.md) (replace the pending placeholder).

## Smoke after deploy

Open these on the production host (replace `<host>`):

| Check    | URL                                                                          |
| -------- | ---------------------------------------------------------------------------- |
| Home     | `https://<host>/`                                                            |
| Health   | `https://<host>/api/health` → JSON `{ "ok": true, "service": "simplified" }` |
| Learn    | `https://<host>/learn/radicals`                                              |
| Practice | `https://<host>/learn/radicals/practice`                                     |

Done when a Human can browse radicals and complete one practice round on the public URL.

## CLI (optional)

If you use the Vercel CLI instead of the dashboard:

```bash
npx vercel link          # once per machine / project
npx vercel               # preview
npx vercel --prod        # production
```

Authenticate with your own account. Never paste a Vercel token into git, `docs/`, or PR descriptions.

## Custom domains

Out of scope for SIM-006. The `*.vercel.app` production URL is enough for MVP smoke. Add a custom domain later in Vercel Project Settings → Domains if desired.

## Troubleshooting

- **Wrong Node version:** set the project to Node 22.x and redeploy.
- **Build fails locally too:** run `bash scripts/ci.sh` and fix before redeploying.
- **Health not JSON / 404:** confirm the deployment used this repo’s `app/api/health` route and finished successfully.
