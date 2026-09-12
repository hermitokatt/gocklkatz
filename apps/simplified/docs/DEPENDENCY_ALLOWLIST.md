# Dependency allowlist

Direct dependencies allowed in this repository. Add a ticket + update this file
before introducing a new package.

## Runtime (`dependencies`)

| Package     | Why                                      |
| ----------- | ---------------------------------------- |
| `next`      | App Router framework (16.x)              |
| `react`     | UI (19.x)                                |
| `react-dom` | React DOM renderer                       |
| `zod`       | Route Handler / domain schema validation |

## Development (`devDependencies`)

| Package              | Why                       |
| -------------------- | ------------------------- |
| `typescript`         | Strict TypeScript         |
| `eslint`             | Lint gate                 |
| `eslint-config-next` | Next.js ESLint rules      |
| `@types/node`        | Node typings              |
| `@types/react`       | React typings             |
| `@types/react-dom`   | React DOM typings         |
| `vitest`             | Unit tests under `tests/` |

## Explicitly not allowed (MVP)

Unless a later STE updates this file:

- Tailwind / shadcn / CSS-in-JS frameworks
- Auth SDKs, databases/ORMs, AI SDKs
- Playwright / E2E runners
- Unused utility libraries (`lodash`, `axios`, etc.)

Fonts are loaded via `next/font/google` (no extra npm packages).
