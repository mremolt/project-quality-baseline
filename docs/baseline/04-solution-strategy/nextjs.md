# Solution Strategy: Next.js

The key technology decisions for Next.js frontends. Next.js builds on the React stack ([react.md](react.md), `REACT-D*`): every React default applies unless a row below replaces it. Both tighten the shared strategy in [04-solution-strategy/README.md](README.md) and the TypeScript defaults in [typescript.md](typescript.md), and never contradict them. Navigation and skills for this stack: [stacks/nextjs.md](../stacks/nextjs.md).

A Next.js app is more than a frontend: it is its own image and release unit, and it is the BFF of its browser users (logins, sessions, token relay, the CSP). It replaces the React SPA defaults marked "React SPA" (Vite build, TanStack Router, `/config.json`, bundle served by another BFF).

## When to choose Next.js

The React SPA is the default React form. A product chooses Next.js only for a stated reason that the SPA cannot meet:

- **Public pages that need server-rendered HTML**: search engine indexing, link previews, content that must be readable before JavaScript runs.
- **A first-paint budget** the SPA misses on the product's target devices, measured, not assumed.
- **Streaming** of server-rendered content (large pages whose parts arrive as they are ready).

Not reasons on their own: file-based routing, "server components are modern", wanting API routes (the backend owns the API, API-CON-*), or a preference for one framework. The price is real: an own image and release unit, a Node.js BFF with a session store ([node-bff.md](../08-crosscutting-concepts/security/node-bff.md)), server actions as public endpoints, server-side observability and version-skew handling.

The product records the choice and its reason in its own chapter 4 (`docs/architecture/04-solution-strategy.md`); it needs no ADR. Leaving a default below needs an ADR.

## Stack at a glance

Next.js 16.4 (App Router in `src/app/`, Turbopack, `src/proxy.ts`, `output: 'standalone'`) · React 19.3 with the React Compiler 1.0 (`reactCompiler: true`, `babel-plugin-react-compiler`) · TanStack Query 5.107 · Redux Toolkit 2.14 + React Redux 9.3 · MUI 9.5 with `@mui/material-nextjs` 9.5 and Emotion 11.14 · React Hook Form 7.92 + `@hookform/resolvers` 7.0 · zod 4.6 · next-intl 4.15 · `server-only` 0.0.1 · openid-client 6.9 · node-redis 6.3 (session store) · pino 10.4 · OpenTelemetry Node SDK 0.301 (`@opentelemetry/api` 1.10) · Orval 8.47 (two `fetch` clients: browser and server, zod schemas, MSW handlers) · MSW 3.0 + `@faker-js/faker` 10.6 · Vitest 5.1 + vitest-mock-extended 6.0 + Testing Library + jsdom 31 · Testcontainers 12.2 (Redis) · Playwright 1.65 + axe-core 4.14 · ESLint 10.14 with the React set and `@next/eslint-plugin-next` 16.4 · TypeScript 6.0 (typescript-eslint 8.72 requires `< 6.1`) · Prettier 3.10 · dependency-cruiser 18.7 · Node.js 26 and npm 11, runtime image `gcr.io/distroless/nodejs26-debian13`.

Versions are major.minor of the validated setup; the exact pins live in the template `package.json` of the `baseline-nextjs` skill.

## Defaults

| # | Topic | Default | Defined in |
|---|---|---|---|
| NEXT-D1 | Framework | Next.js with the App Router in `src/app/`, Turbopack for dev and build, React Compiler on; no Pages Router, no webpack. Replaces REACT-D1 and REACT-D2 | [05-building-block-view/nextjs.md](../05-building-block-view/nextjs.md), [nextjs-tooling.md](../08-crosscutting-concepts/development/nextjs-tooling.md) |
| NEXT-D2 | Deployment and BFF | Own image from `output: 'standalone'`, own release unit; the app is the BFF for its browser users (NODE-BFF-*); REL-FE-01..05 do not apply. Replaces REACT-D9 | [07-deployment-view/nextjs-delivery.md](../07-deployment-view/nextjs-delivery.md), [security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md) |
| NEXT-D3 | Rendering | Dynamic by default; static or cached only for public pages without personal data and without nonce needs | [05-building-block-view/nextjs.md](../05-building-block-view/nextjs.md) (NEXT-ARCH-10) |
| NEXT-D4 | Server code | Server components, server actions and route handlers are incoming adapters that call use cases; never a database, `fetch` or a generated client directly | [05-building-block-view/nextjs.md](../05-building-block-view/nextjs.md) (NEXT-ARCH-02..05) |
| NEXT-D5 | Stubbed E2E tier | MSW inside the Next.js server in test mode with Orval's handlers; one build, the stubs start only in a test environment | [testing/nextjs.md](../08-crosscutting-concepts/testing/nextjs.md) |
| NEXT-D6 | i18n | `next-intl`. Replaces REACT-D7 (`use-intl`) | [i18n/nextjs.md](../08-crosscutting-concepts/i18n/nextjs.md) |
| NEXT-D7 | Configuration | Server environment validated with zod (`server-only`); the public subset is passed to a client provider; `NEXT_PUBLIC_*` is not used for per-environment values. Replaces the SPA's `/config.json` | [configuration/nextjs.md](../08-crosscutting-concepts/configuration/nextjs.md) |
| NEXT-D8 | Auth | `openid-client` 6 in route handlers, server-side session store (Redis or Postgres); no Auth.js / `next-auth`, no `iron-session` token cookies | [security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md) |
| NEXT-D9 | Lint | REACT-D10 plus `@next/eslint-plugin-next` (`core-web-vitals`, raised to errors) run through ESLint directly; `next lint` and `eslint-config-next` are not used | [nextjs-tooling.md](../08-crosscutting-concepts/development/nextjs-tooling.md) |
| NEXT-D10 | Server-side API calls | A second Orval `fetch` output bound to a `server-only` mutator that relays the session's access token, with timeouts; browser calls go through the BFF's `/api` proxy | [api/nextjs-openapi-clients.md](../08-crosscutting-concepts/api/nextjs-openapi-clients.md) |
| NEXT-D11 | Server telemetry and logs | Plain OpenTelemetry Node SDK started in `src/instrumentation.ts`, pino JSON logs, `onRequestError`; no `@vercel/otel` | [observability/nextjs.md](../08-crosscutting-concepts/observability/nextjs.md) |
| NEXT-D12 | Agent instructions | `agentRules: false`; the baseline's synced `AGENTS.md` is the only agent instruction file | [nextjs-tooling.md](../08-crosscutting-concepts/development/nextjs-tooling.md) (NEXT-TOOL-10) |

*Agent checklist in [checklists/nextjs.md](../checklists/nextjs.md) and sources in [sources.md](../sources.md), section "Solution Strategy: Next.js".*
