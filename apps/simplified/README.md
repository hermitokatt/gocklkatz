# Simplified

An application for learning and practicing simplified Chinese characters (汉字).

## Production

Production URL: _pending Human Vercel link_

Deploy steps: [`docs/DEPLOY.md`](docs/DEPLOY.md). After the first successful Vercel production deploy, replace the placeholder above with the live `*.vercel.app` (or custom) URL. Smoke: `/`, `/api/health`, `/learn/radicals`, `/learn/radicals/practice`.

## MVP

First ship: a website (frontend + backend) for **learning radicals and common components**. Charter and phases: [`docs/MVP.md`](docs/MVP.md). Implementation slices: [`docs/ROADMAP.md`](docs/ROADMAP.md). Research notes: [`docs/hanzi_research.md`](docs/hanzi_research.md).

**Stack:** Next.js App Router 16.x, React 19, TypeScript (strict), Zod Route Handlers, Vitest, Vercel — aligned with [software-factory-demo](https://cursor.com/codebase/gocklkatz/software-factory-demo) (rewrite, don’t copy). CSS-first UI (no Tailwind in Phase 0). Allowed packages: [`docs/DEPENDENCY_ALLOWLIST.md`](docs/DEPENDENCY_ALLOWLIST.md).

## Run locally

Requires **Node 22+**.

```bash
npm install
npm run dev
```

Then open **[http://localhost:3000](http://localhost:3000)** (home) and [http://localhost:3000/api/health](http://localhost:3000/api/health).

`next dev` also prints a **Network** URL (`http://10.x.x.x:3000`). That address is fine here: `next.config.ts` auto-allowlists this machine’s LAN IPs for HMR. Prefer localhost when you can; use Network when testing from another device on the LAN.

To run without the dev/HMR server (production mode):

```bash
npm run build && npm run start
```

### Quality gate

```bash
bash scripts/ci.sh
```

Runs lint, typecheck, Vitest, and production build.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local Next.js server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest |
| `npm run build` | Production build |
| `npm run ci` | Full `scripts/ci.sh` gate |

## Agents

See [`AGENT.md`](AGENT.md) for Linear workflow and delivery rules.
