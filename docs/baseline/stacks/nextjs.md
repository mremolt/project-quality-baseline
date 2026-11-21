# Next.js

Rules for Next.js apps (App Router). Next.js builds on the React layer ([stacks/react.md](react.md)): a Next.js project reads the shared docs, [stacks/typescript.md](typescript.md), the React docs (skipping rules marked **(React SPA)** and files whose intro says "Scope: React SPA") and the docs below. A Next.js rule never repeats a React rule; where it replaces an SPA default it says so. It never needs another frontend or backend stack's docs. Stack at a glance and defaults (`NEXT-D*`): [04-solution-strategy/nextjs.md](../04-solution-strategy/nextjs.md).

**Agents:** start with the rule index ([shared](../rule-index/shared.md), [typescript](../rule-index/typescript.md), [react](../rule-index/react.md), [nextjs](../rule-index/nextjs.md)): every rule ID with its headline. Open the docs below only for the topics the task touches, never all at once (TOOL-SKL-10).

A Next.js app is its own image and the BFF for its browser users (NEXT-D2), so it carries backend concerns: login and session, server-side calls with timeouts, probes, logs, telemetry and its own deployment. A product records the choice of Next.js and its reason (public pages that need server rendering, first-paint budgets, streaming) in its chapter 4; choosing a documented stack needs no ADR.

| Doc | Covers | Rule IDs |
|---|---|---|
| [05-building-block-view/nextjs.md](../05-building-block-view/nextjs.md) | `src/app/` as routing and root composition, server and client composition, server components, server actions and route handlers as incoming adapters, `server-only`, `proxy.ts`, rendering default, platform entry points, new app, dependency-cruiser | `NEXT-ARCH-*` |
| [08-crosscutting-concepts/api/nextjs-openapi-clients.md](../08-crosscutting-concepts/api/nextjs-openapi-clients.md) | Server-side Orval client with token relay and timeouts, browser calls through the `/api` proxy | `NEXT-API-*` |
| [08-crosscutting-concepts/security/node-bff.md](../08-crosscutting-concepts/security/node-bff.md) | Framework-neutral BFF rules: OIDC login, session store, cookie, CSRF, lifetimes, logout, nonce CSP, adoption gate | `NODE-BFF-*` |
| [08-crosscutting-concepts/security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md) | BFF wiring in Next.js, `proxy.ts` nonce CSP and headers, Trusted Types default policy, server actions as public endpoints, secrets never in client props, test-stub guard | `NEXT-SEC-*` |
| [08-crosscutting-concepts/configuration/nextjs.md](../08-crosscutting-concepts/configuration/nextjs.md) | Validated server environment, public subset for the client, `NEXT_PUBLIC_*` ban, secrets, release version (shared: [configuration.md](../08-crosscutting-concepts/configuration/configuration.md)) | `NEXT-CFG-*`, `CFG-*` |
| [08-crosscutting-concepts/resilience/nextjs.md](../08-crosscutting-concepts/resilience/nextjs.md) | Timeout ladder, no server-side retries, concurrency, dynamic rendering and caching (shared: [resilience.md](../08-crosscutting-concepts/resilience/resilience.md)) | `NEXT-RES-*`, `RES-*` |
| [08-crosscutting-concepts/observability/nextjs.md](../08-crosscutting-concepts/observability/nextjs.md) | `instrumentation.ts`, OpenTelemetry, pino logs, probes, graceful shutdown, `error.tsx` (shared: [observability.md](../08-crosscutting-concepts/observability/observability.md)) | `NEXT-OBS-*`, `OBS-*` |
| [08-crosscutting-concepts/i18n/nextjs.md](../08-crosscutting-concepts/i18n/nextjs.md) | `next-intl` in server and client components, locale resolution, language switch (shared: [i18n.md](../08-crosscutting-concepts/i18n/i18n.md)) | `NEXT-I18N-*`, `I18N-*` |
| [08-crosscutting-concepts/testing/nextjs.md](../08-crosscutting-concepts/testing/nextjs.md) | Server components, actions and route handlers as adapters, BFF tests, MSW inside the server, E2E against the standalone server | `NEXT-TEST-*` |
| [08-crosscutting-concepts/development/nextjs-tooling.md](../08-crosscutting-concepts/development/nextjs-tooling.md) | `next.config.ts`, tsconfig, ESLint without `next lint`, scripts, agent files, upgrades | `NEXT-TOOL-*` |
| [07-deployment-view/nextjs-local-development.md](../07-deployment-view/nextjs-local-development.md) | Compose for Redis, dev server, stubbed backend and IdP, debugging | `NEXT-DEV-*` |
| [07-deployment-view/nextjs-delivery.md](../07-deployment-view/nextjs-delivery.md) | Standalone image, Dockerfile, read-only filesystem, termination, version skew, own release unit, SBOM (shared: [delivery-and-release.md](../07-deployment-view/delivery-and-release.md), [container-runtime.md](../07-deployment-view/container-runtime.md)) | `NEXT-REL-*`, `REL-*` |

## Skills for Next.js work

Load these when creating or editing Next.js code (the `baseline-nextjs` skill does this for you):

| Skill | For |
|---|---|
| `baseline-nextjs` (own) | Entry point: docs to read, skills to load, overrides, workflow, templates |
| `vercel-react-best-practices` | React and Next.js rendering and bundle performance |
| `tanstack-query-best-practices` | TanStack Query in client components |
| `material-ui-theming`, `material-ui-styling` (official MUI) | MUI theme and styling |
| `baseline-security` (own) | Security rules by task, review checklist, BFF |
| `baseline-i18n` (own) | Multilingual products |
| `accessibility` | WCAG 2.2 know-how |
| `vitest`, `playwright-best-practices`, `playwright-cli` | Tests and browser checks |
| `orval` | Generated API clients |
| `baseline-tdd` (own) | Test-first workflow |

The Next.js documentation bundled in `node_modules/next/dist/docs` is the API reference for the installed version (NEXT-TOOL-11). **Where a skill, that documentation or a generated agent file disagrees with these docs, the docs win** (TOOL-SKL-01). Known conflicts are listed in the "Skill overrides" tables of the Next.js docs ([architecture](../05-building-block-view/nextjs.md#skill-overrides), [API clients](../08-crosscutting-concepts/api/nextjs-openapi-clients.md#skill-overrides), [security](../08-crosscutting-concepts/security/nextjs.md#skill-overrides), [configuration](../08-crosscutting-concepts/configuration/nextjs.md#skill-overrides), [resilience](../08-crosscutting-concepts/resilience/nextjs.md#skill-overrides), [observability](../08-crosscutting-concepts/observability/nextjs.md#skill-overrides), [i18n](../08-crosscutting-concepts/i18n/nextjs.md#skill-overrides), [testing](../08-crosscutting-concepts/testing/nextjs.md#skill-overrides), [tooling](../08-crosscutting-concepts/development/nextjs-tooling.md#skill-overrides)) and of the React docs ([stacks/react.md](react.md#skills-for-react-work)).

## Skill overrides

The most frequent ones:

| Habit | Baseline rule |
|---|---|
| `fetch`, a database client or a generated client in `page.tsx`, a server component or a server action | Server components, actions and route handlers are incoming adapters that call use cases (NEXT-D4, NEXT-ARCH-01..05) |
| Business logic in `src/app/**` | Route files are thin: params in, feature page out (NEXT-ARCH-01) |
| `'use cache'`, ISR, `export const dynamic = 'force-static'` on pages with personal data | Dynamic by default; static or cached only for public pages without personal data or nonce (NEXT-D3) |
| `NEXT_PUBLIC_*` for environment values | Validated server configuration, public subset to the client (NEXT-D7, NEXT-CFG-01) |
| Auth.js / `next-auth`, `iron-session` with tokens in the cookie | `openid-client` and a server-side session store (NEXT-D8, NODE-BFF-03/05) |
| Server action trusting its bound arguments or skipping the session check | Every action is a public endpoint: session, authorization in the use case, zod parsing (NEXT-SEC) |
| `middleware.ts` | `src/proxy.ts`, only nonce, headers and request checks (NEXT-ARCH-11) |
| `next lint`, `eslint-config-next` | ESLint flat config with `@next/eslint-plugin-next` (NEXT-D9) |
| Generated `AGENTS.md` from `next dev`, `next upgrade --agent` | `agentRules: false`; the baseline's `AGENTS.md` is the only agent instruction file (NEXT-D12, NEXT-TOOL-10/12) |
| Vercel-specific features (Fluid Compute, `after()` for required work, image optimization service) | Self-hosted standalone image (NEXT-D2, NEXT-REL-*) |
| `create-next-app` scaffold | Template of `baseline-nextjs` (NEXT-ARCH new app) |
