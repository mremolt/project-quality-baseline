---
name: baseline-nextjs
description: Entry point for any Next.js work in a project that uses the quality baseline - App Router pages, layouts and route files, server and client components, server actions, route handlers, proxy.ts, BFF login and session (openid-client, Redis), the /api proxy, server and browser Orval clients, server configuration and its public subset, instrumentation.ts, logs, probes, next-intl, Redux Toolkit, TanStack Query, React Hook Form, MUI, Next.js tests (Vitest, Testing Library, MSW, Playwright against the standalone server), next.config.ts, the Dockerfile, and creating a new Next.js app. Loads the right skills (vercel-react-best-practices, tanstack-query-best-practices, material-ui-theming, material-ui-styling, orval, accessibility, vitest, playwright-best-practices, baseline-tdd, baseline-security) and applies the baseline's rules, which override those skills and the Next.js docs. Use it before writing or changing any Next.js code.
---

# Next.js in the quality baseline

The baseline docs are the rules; skills and the Next.js docs supply framework know-how. **Where a skill, the bundled Next.js docs or a generated agent file disagrees with the baseline docs, the baseline docs win** (TOOL-SKL-01, NEXT-TOOL-11). Paths are relative to the project root; stack commands run from the component folder, usually `frontend/` (REPO-TOOL-03). A Next.js project reads the shared docs, the TypeScript docs, the React docs and the Next.js docs below, and nothing else: no Angular, Spring or NestJS docs, and no React SPA template (TOOL-SKL-09). In the React docs, skip every rule marked **(React SPA)** and every file whose intro says "Scope: React SPA"; where a Next.js rule says "Replaces …", the Next.js rule applies. Do not load `baseline-react`: it points to the SPA templates.

## 1. Read the rules for the task

Always: `docs/baseline/stacks/nextjs.md`, `docs/baseline/05-building-block-view/nextjs.md`, `docs/baseline/05-building-block-view/react.md`, `docs/baseline/05-building-block-view/typescript.md`.

| Task | Also read |
|---|---|
| Use case, port, command, domain type, error | `docs/baseline/05-building-block-view/use-cases.md`, `docs/baseline/08-crosscutting-concepts/mapping/mapping-between-boundaries.md` |
| Route file, server component, client component, page, layout | NEXT-ARCH-01/02/06/10/14..17, `docs/baseline/08-crosscutting-concepts/ui/react-mui.md`, `ui/ui-patterns.md`, `docs/baseline/10-quality-requirements/accessibility.md` |
| Server action | NEXT-ARCH-04, NEXT-SEC-04/05/07 in `docs/baseline/08-crosscutting-concepts/security/nextjs.md`, NEXT-RES-05, NEXT-REL-18 |
| Route handler, `/api` proxy, probes | NEXT-ARCH-05, `docs/baseline/08-crosscutting-concepts/api/nextjs-openapi-clients.md` (NEXT-API-06), `observability/nextjs.md` |
| Login, session, logout, CSRF, cookies | `docs/baseline/08-crosscutting-concepts/security/node-bff.md`, `security/nextjs.md` (NEXT-SEC-01/02) |
| `proxy.ts`, CSP, nonce, Trusted Types, headers | NEXT-ARCH-11, `security/nextjs.md` (NEXT-SEC-03/05/08/10/11), `security/react.md`, `security/typescript.md` |
| Slice, thunk, query hook, query keys, optimistic update | `docs/baseline/08-crosscutting-concepts/ui/react-state-management.md`, NEXT-ARCH-15/16 |
| HTTP adapter, API client, backend data | `docs/baseline/08-crosscutting-concepts/api/typescript-openapi-clients.md`, `api/react-openapi-clients.md`, `api/nextjs-openapi-clients.md`, `api/avoiding-n-plus-one.md`, NEXT-ARCH-09 |
| Configuration, environment variables, secrets, public config | `docs/baseline/08-crosscutting-concepts/configuration/configuration.md`, `configuration/nextjs.md` |
| Timeouts, retries, caching, `'use cache'` | `docs/baseline/08-crosscutting-concepts/resilience/resilience.md`, `resilience/nextjs.md` |
| Logs, telemetry, `instrumentation.ts`, `error.tsx`, shutdown | `docs/baseline/08-crosscutting-concepts/observability/observability.md`, `observability/react.md`, `observability/nextjs.md` |
| Tests | `docs/baseline/08-crosscutting-concepts/testing/testing-by-architecture-element.md`, `testing/tdd.md`, `testing/typescript.md`, `testing/typescript-e2e.md`, `testing/react.md`, `testing/nextjs.md` |
| User-visible text, locales, formatting (only if the project ADR says i18n is in scope, I18N-01) | `docs/baseline/08-crosscutting-concepts/i18n/i18n.md`, `i18n/react.md`, `i18n/nextjs.md` |
| Personal data, third-party resources, fonts | `docs/baseline/08-crosscutting-concepts/data-protection/data-protection.md`, REACT-UI-13 |
| `next.config.ts`, tsconfig, ESLint, scripts, bundle budgets, upgrades | `docs/baseline/08-crosscutting-concepts/development/typescript-tooling.md`, `development/react-tooling.md`, `development/nextjs-tooling.md` |
| Local dev server, Compose, stubs, debugging | `docs/baseline/07-deployment-view/nextjs-local-development.md` |
| Dockerfile, image, release, version skew | `docs/baseline/07-deployment-view/nextjs-delivery.md`, `07-deployment-view/container-runtime.md`, `07-deployment-view/delivery-and-release.md` |
| New app | NEXT-ARCH-12, `docs/baseline/07-deployment-view/repository-layout.md` |

For a Next.js API, look it up in `node_modules/next/dist/docs/` of the installed version, not in training data or `latest` web pages (NEXT-TOOL-11).

## 2. Load the skills for the task

| Task | Skills |
|---|---|
| Any React or Next.js code | `vercel-react-best-practices` |
| Query hooks, cache, invalidation | `tanstack-query-best-practices` |
| Theme, tokens, styling | `material-ui-theming`, `material-ui-styling` |
| UI, forms, dialogs, navigation | `accessibility` |
| API clients | `orval` |
| Tests | `baseline-tdd`, `vitest`, `playwright-best-practices`; `playwright-cli` to check the running app |
| BFF, session, CSP, server actions, any security-relevant change | `baseline-security` |
| Multilingual product | `baseline-i18n` |
| IDE config | `baseline-ide-setup` |

## 3. Overrides you will hit most often

Full tables: the "Skill overrides" sections linked from `docs/baseline/stacks/nextjs.md` and `docs/baseline/stacks/react.md`.

| Skill habit or Next.js docs | Baseline rule |
|---|---|
| `fetch`, a database or generated client in `page.tsx`, a server component or a server action | Incoming adapters call use cases; the server Orval client sits behind an outgoing port (NEXT-D4, NEXT-ARCH-02..05, NEXT-API-07) |
| Logic, data loading or JSX trees in `src/app/**` | Route files re-export a feature page or bind a platform handler (NEXT-ARCH-01) |
| `'use client'` or `'use server'` in any file | Only in `*.client.tsx`, `*.composition.tsx`, the root client files, and `adapter/in/next/*-actions.ts` (NEXT-ARCH-04/06, NEXT-TOOL-06) |
| Server action trusting its arguments, closures or bound values | Public endpoint: session, zod `.strict()` parsing, authorization in the use case; origin gate in `proxy.ts` (NEXT-SEC-04/05/07) |
| `'use cache'`, ISR, `force-static`, `fetch` with `next.revalidate` | Dynamic by default; caching only for public pages by ADR (NEXT-D3, NEXT-ARCH-10, NEXT-RES-07/08) |
| `NEXT_PUBLIC_*`, `env` in `next.config`, `process.env` in a component | Server configuration parsed in `register()`, public subset through the root layout (NEXT-D7, NEXT-CFG-01..05) |
| Auth.js / `next-auth`, `iron-session`, tokens in the browser | `openid-client` and the session store; tokens only on the server (NEXT-D8, NODE-BFF-03/05) |
| `middleware.ts`, auth or redirects in the proxy | `src/proxy.ts`: nonce, CSP, headers, action origin gate only (NEXT-ARCH-11) |
| Importing `@/platform/index.client` in a server file | Three entry points; server files use `index.server`, the core uses `index` (NEXT-ARCH-14) |
| Server-rendered data copied into a slice, or refetched after hydration | `initialData` for TanStack Query (NEXT-ARCH-16) |
| `<TextField {...field} />` in a `Controller` | `field: { ref, ...field }` and `inputRef={ref}` (REACT-ARCH-14) |
| `retry: 3`, retries on the server | Browser queries retry transient failures with jitter; no server-side retries (REACT-STATE-15, NEXT-RES-04) |
| `elevation` on a server-rendered `Paper`, `'unsafe-inline'` for styles | `variant="outlined"`; the CSP is never loosened (NEXT-SEC-11) |
| `next lint`, `eslint-config-next` | ESLint with the React set and `@next/eslint-plugin-next` (NEXT-D9, NEXT-TOOL-05) |
| Generated `AGENTS.md`, `next upgrade --agent`, `@next/codemod@latest` | `agentRules: false`; upgrades through the automation, pinned codemods (NEXT-TOOL-10/12) |
| `@vercel/otel`, Vercel-only features, `next start`, Buildpacks | Plain OpenTelemetry Node SDK; standalone image from the Dockerfile (NEXT-OBS-01, NEXT-REL-04..06) |
| `create-next-app` | Templates below (NEXT-ARCH-12) |

## 4. Workflow

1. **Place it.** Ring, folder and file name for every new file (REACT-ARCH-01..03); the file name shows server-only (`.server.ts`) or client (`.client.tsx`) code (NEXT-ARCH-06); wiring only in the server and client compositions (NEXT-ARCH-03/15); other features only through their `index.ts`.
2. **N+1 check** for anything that loads data, including server-side waterfalls (API-N1-01, NEXT-ARCH-09): fill in the template from `avoiding-n-plus-one.md`, recommend a strategy, and let the developer decide.
3. **Test first** with `baseline-tdd`: test type per element from `testing/nextjs.md` and `testing/react.md` (route handlers and action handlers as adapter tests, NEXT-TEST-05/06; `proxy.ts` decisions as pure functions, NEXT-TEST-07; server components stay thin, NEXT-TEST-04).
4. **Accessibility as you go**: REACT-UI-26..33; axe in component tests; the E2E axe fixture in light, dark and high-contrast for changed screens (NEXT-TEST-15, A11Y-05).
5. **Security and data as you go**: nothing secret in client props or action results (NEXT-ARCH-07, NEXT-SEC-06); every action and route handler resolves the session; new entry points get a threat model (NEXT-SEC-09, SEC-TM-02); new personal data → inventory and deletion concept (DP-INV-03).
6. **Contract**: changed spec → `npm run generate:api`; both server and browser outputs, adapters, mappers and problem `code`s updated (NEXT-API-01, TS-ARCH-18).
7. **Configuration**: a new key goes into the schema with `.describe()`, into `configuration-keys.yaml` and, if local, into `.env.development` (NEXT-CFG-02/09, NEXT-DEV-03).
8. **Shortcuts**: propose and draft an ADR; never take one silently (ARCH-SC-06).
9. **Finish** with `npm run verify` and `npm run e2e` green, and no dependency-cruiser rule, lint rule, bundle budget, CSP, Trusted Types policy or a11y check loosened.

## 5. New app

Follow NEXT-ARCH-12. The templates are in this skill's `templates/` folder (`.agents/skills/baseline-nextjs/templates/` in a project); `templates/README.md` says where each file goes and what to rename. Template file names have no leading dot (`npmrc` → `frontend/.npmrc`, `nvmrc` → `frontend/.nvmrc`, `gitignore` → `frontend/.gitignore`, `dockerignore` → `frontend/.dockerignore`, `prettierrc.json` → `frontend/.prettierrc.json`, `prettierignore` → `frontend/.prettierignore`, `dependency-cruiser.cjs` → `frontend/.dependency-cruiser.cjs`, `env.development` → `frontend/.env.development`). Check that the repository layout decision was made first (REPO-LAY-02). Install with `npm install` once to create the lockfile, then `npm ci`; `npm run verify` and `npm run e2e` must be green before the first feature, and the product records the choice of Next.js in its chapter 4 (`docs/baseline/stacks/nextjs.md`).
