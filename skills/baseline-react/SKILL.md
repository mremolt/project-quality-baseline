---
name: baseline-react
description: Entry point for any React SPA work in a project that uses the quality baseline - creating or editing components, pages, hooks, use-case contexts (tokens), composition and feature API files, Redux Toolkit slices, TanStack Query hooks and mutations, React Hook Form forms, MUI theming and styling, TanStack Router routes, HTTP adapters with Orval, i18n with use-intl, React tests (Vitest, Testing Library, MSW, Playwright), and creating a new React SPA. Loads the right skills (vercel-react-best-practices, tanstack-query-best-practices, material-ui-theming, material-ui-styling, orval, accessibility, vitest, playwright-best-practices, baseline-tdd, baseline-security) and applies the baseline's rules, which override those skills. Use it before writing or changing any React code.
---

# React in the quality baseline

The baseline docs are the rules; skills supply framework know-how. **Where a skill disagrees with the docs, the docs win** (TOOL-SKL-01). Paths are relative to the project root; stack commands run from the component folder, usually `frontend/` (REPO-TOOL-03). Read only the docs below: a React project never needs the Angular, Next.js or backend stack docs (TOOL-SKL-09). Next.js app: use `baseline-nextjs`.

## 1. Read the rules for the task

Never read every doc of the stack up front (TOOL-SKL-10). At the start: the rule index in `docs/baseline/rule-index/` (`shared.md`, `typescript.md`, `react.md`), one line per rule ID, and `docs/baseline/05-building-block-view/react.md`, `docs/baseline/05-building-block-view/typescript.md`. Then only the docs of the rows below that match the task; for a rule from a doc you have not read, search the doc for its ID and read that bullet.

| Task | Also read |
|---|---|
| Use case, port, command, domain type, error | `docs/baseline/05-building-block-view/use-cases.md`, `docs/baseline/08-crosscutting-concepts/mapping/mapping-between-boundaries.md` |
| Component, page, hook, dialog, form, route title and focus | `docs/baseline/08-crosscutting-concepts/ui/react-mui.md`, `ui/ui-patterns.md`, `docs/baseline/10-quality-requirements/accessibility.md` |
| Slice, query hook, mutation (command), query keys, optimistic update | `docs/baseline/08-crosscutting-concepts/ui/react-state-management.md` |
| HTTP adapter, API client, backend data | `docs/baseline/08-crosscutting-concepts/api/typescript-openapi-clients.md`, `api/react-openapi-clients.md`, `api/avoiding-n-plus-one.md` |
| Tests | `docs/baseline/08-crosscutting-concepts/testing/testing-by-architecture-element.md`, `testing/tdd.md`, `testing/typescript.md`, `testing/typescript-e2e.md`, `testing/react.md` |
| User-visible text, locales, formatting (only if the project ADR says i18n is in scope, I18N-01) | `docs/baseline/08-crosscutting-concepts/i18n/i18n.md`, `i18n/react.md` |
| Data in the DOM, URLs, CSP, Trusted Types, XSRF, error UI | `docs/baseline/08-crosscutting-concepts/security/react.md`, `security/typescript.md` |
| Runtime configuration, `/config.json`, environments | `docs/baseline/08-crosscutting-concepts/configuration/configuration.md`, `configuration/react.md` |
| Error boundaries, error reporting, source maps | `docs/baseline/08-crosscutting-concepts/observability/observability.md`, `observability/react.md` |
| Retries, timeouts | `docs/baseline/08-crosscutting-concepts/resilience/resilience.md` (RES-RTY, RES-TMO), REACT-STATE-15, REACT-API-05 |
| Personal data in the UI, third-party resources, fonts | `docs/baseline/08-crosscutting-concepts/data-protection/data-protection.md`, REACT-UI-13 |
| tsconfig, ESLint, scripts, bundle budgets, upgrades | `docs/baseline/08-crosscutting-concepts/development/typescript-tooling.md`, `development/react-tooling.md` |
| Bundle delivery by the BFF, chunk reload | `docs/baseline/07-deployment-view/container-runtime.md` (REL-FE-*), REACT-ARCH-21 |
| New app | REACT-ARCH-17 in `05-building-block-view/react.md`, `docs/baseline/07-deployment-view/repository-layout.md` |

## 2. Load the skills for the task

| Task | Skills |
|---|---|
| Any React code | `vercel-react-best-practices` |
| Query hooks, cache, invalidation | `tanstack-query-best-practices` |
| Theme, tokens, styling | `material-ui-theming`, `material-ui-styling` |
| UI, forms, dialogs, navigation | `accessibility` |
| API clients | `orval` |
| Tests | `baseline-tdd`, `vitest`, `playwright-best-practices`; `playwright-cli` to check the running app |
| Security-relevant change | `baseline-security` |
| Multilingual product | `baseline-i18n` |
| IDE config | `baseline-ide-setup` |

## 3. Overrides you will hit most often

Full tables: the "Skill overrides" sections linked from `docs/baseline/stacks/react.md`.

| Skill habit | Baseline rule |
|---|---|
| `fetch`, a generated client or `useEffect` loading in a component | Query hook in `<feature>.queries.ts` whose `queryFn` calls a use case from the feature's selector hook (REACT-ARCH-13, TS-ARCH-04) |
| Orval `react-query`/`swr` client, RTK Query | Orval `fetch` client with the platform mutator; RTK only for view state (REACT-API-01, REACT-STATE-09) |
| Backend data copied into a slice; thunk that fetches or runs a command | Data in the query cache; commands are `useMutation`s calling the use case, errors via `toErrorKey`, invalidation in `onSuccess`; slices hold cross-component view state only (REACT-STATE-03/04) |
| `new HttpX()` in a component or provider render; one context per use case | Adapters and use cases created once per provider with a lazy `useState` initializer in `<feature>.api.tsx`; one context per feature with a typed use-case object and selector hooks in `<feature>.tokens.ts` (REACT-ARCH-09/10) |
| File-based routing, `.lazy()` files, `React.lazy` routes | `<feature>.routes.ts` with route options and `lazyRouteComponent` (REACT-ARCH-20/21) |
| `memo`, `useMemo`, `useCallback` everywhere | React Compiler; manual memoization only when measured (REACT-ARCH-05) |
| `<TextField {...field} />` in a `Controller` | `field: { ref, ...field }` and `inputRef={ref}` (REACT-ARCH-14, REACT-TEST-10) |
| `retry: 3`, cache persisted to `localStorage` | Transient-only retries with jitter (REACT-STATE-15); no backend data in web storage (TS-SEC-01) |
| Tailwind, shadcn/ui, hex colours, px sizes | MUI theme tokens, logical properties (REACT-D5, REACT-UI-05/22) |
| `VITE_*` per environment, release version in `define` | `/config.json` at runtime; `define` only for the commit (REACT-CFG-01, REACT-TOOL-11) |
| `dangerouslySetInnerHTML`, `innerHTML` | Banned by lint (REACT-SEC-01..03) |
| `vi.mock` of hooks, MSW in component tests | An object of mocked use cases in the feature's context; MSW only for HTTP adapters (REACT-TEST-06/16) |
| `npm create vite`, `vite build` as the final check | Templates below; `npm run verify` (REACT-ARCH-17, REACT-TOOL-12) |

## 4. Workflow

1. **Place it.** Ring, folder and file name for every new file (REACT-ARCH-01..03); core imports only its rings and `src/platform/domain/index.ts` (REACT-ARCH-04); wiring only in the feature's API and composition files (REACT-ARCH-10/11); other features only through their `index.ts` and `<Feature>ApiProvider` (REACT-ARCH-11).
2. **N+1 check** for anything that loads data (API-N1-01, REACT-ARCH-16, REACT-STATE-12): fill in the template from `avoiding-n-plus-one.md`, recommend a strategy, and let the developer decide.
3. **Test first** with `baseline-tdd`: test type and style per element from `testing/react.md` (Chicago for domain, London for use cases, slices, pages and adapters).
4. **Accessibility as you go**: MUI components, labels, `h1` with `tabIndex={-1}`, route `titleKey`, dialogs restore focus, status via the `Announcer` (REACT-UI-26..33); axe in component tests (REACT-TEST-08); E2E axe and keyboard journey for changed main paths (A11Y-05).
5. **Security and data as you go**: no HTML writes, URLs through the helper, mutating calls through the mutator (REACT-SEC-01..06); error UI generic (REACT-SEC-08); new personal data → inventory and deletion concept (DP-INV-03).
6. **Contract**: changed spec → `npm run generate:api`, adapter and mapper updated, problem `code`s mapped (REACT-API-10, TS-ARCH-18).
7. **Shortcuts**: propose and draft an ADR; never take one silently (ARCH-SC-06).
8. **Finish** with `npm run verify` green and `npm run build && npm run e2e` green for changed screens, and no dependency-cruiser rule, lint rule, bundle budget, CSP or a11y check loosened.
9. **Self-review** against the agent checklist sections of the docs you used (`docs/baseline/checklists/`, TOOL-SKL-13).

## 5. New app

Follow REACT-ARCH-17. The templates are in this skill's `templates/` folder (`.agents/skills/baseline-react/templates/` in a project); `templates/README.md` says where each file goes and what to rename. Template file names have no leading dot (`npmrc` → `frontend/.npmrc`, `nvmrc` → `frontend/.nvmrc`, `gitignore` → `frontend/.gitignore`, `dependency-cruiser.cjs` → `frontend/.dependency-cruiser.cjs`, `prettierrc.json` → `frontend/.prettierrc.json`, `prettierignore` → `frontend/.prettierignore`). Check that the repository layout decision was made first (REPO-LAY-02). Install with `npm install` once to create the lockfile, then `npm ci`; `npm run verify` and `npm run build && npm run e2e` must be green before the first feature.
