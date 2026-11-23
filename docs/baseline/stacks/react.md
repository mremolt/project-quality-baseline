# React

Rules for React frontends: a React SPA (Vite, TanStack Router) and, as the base layer, every Next.js app. They implement the shared docs and the TypeScript docs ([stacks/typescript.md](typescript.md)) and may tighten them, never contradict them. Stack at a glance and defaults (`REACT-D*`): [04-solution-strategy/react.md](../04-solution-strategy/react.md).

**Agents:** start with the rule index ([shared](../rule-index/shared.md), [typescript](../rule-index/typescript.md), [react](../rule-index/react.md)): every rule ID with its headline. Open the docs below only for the topics the task touches, never all at once (TOOL-SKL-10).

A React project reads the shared docs, [stacks/typescript.md](typescript.md) and the docs below. A Next.js project reads them too, plus [stacks/nextjs.md](nextjs.md); rules marked **(React SPA)** are replaced there, and files whose intro says "Scope: React SPA" can be skipped. Neither ever needs another frontend or backend stack's docs.

| Doc | Covers | Rule IDs |
|---|---|---|
| [05-building-block-view/react.md](../05-building-block-view/react.md) | Layout, naming, tokens and composition, components and hooks, data loading, forms, error boundaries, (React SPA) Vite, router, lazy routes, chunk reload, bootstrap, new app, dependency-cruiser, platform clock and business date | `REACT-ARCH-*` |
| [08-crosscutting-concepts/ui/react-state-management.md](../08-crosscutting-concepts/ui/react-state-management.md) | Redux Toolkit view state (one store, lazy slices, shared view state only), TanStack Query rules for queries and command mutations, cancelled loads and serialized saves | `REACT-STATE-*` |
| [08-crosscutting-concepts/ui/react-mui.md](../08-crosscutting-concepts/ui/react-mui.md) | MUI theme, tokens, the UI-* patterns in MUI, forms, dialogs, status messages, route title and focus | `REACT-UI-*` |
| [08-crosscutting-concepts/api/react-openapi-clients.md](../08-crosscutting-concepts/api/react-openapi-clients.md) | Orval `fetch` client, platform mutator (XSRF, timeouts, 401, reporting), adapters, MSW handlers | `REACT-API-*` |
| [08-crosscutting-concepts/security/react.md](../08-crosscutting-concepts/security/react.md) | JSX and DOM safety, URLs, (React SPA) CSP nonce and Trusted Types, zod jitless, XSRF, security E2E | `REACT-SEC-*` |
| [08-crosscutting-concepts/configuration/react.md](../08-crosscutting-concepts/configuration/react.md) | (React SPA) one build, `/config.json` before the first render (shared: [configuration.md](../08-crosscutting-concepts/configuration/configuration.md)) | `REACT-CFG-*`, `CFG-*` |
| [08-crosscutting-concepts/observability/react.md](../08-crosscutting-concepts/observability/react.md) | Error boundaries, window listeners, error reporting, trace ids, hidden source maps (shared: [observability.md](../08-crosscutting-concepts/observability/observability.md)) | `REACT-OBS-*`, `OBS-*` |
| [08-crosscutting-concepts/i18n/react.md](../08-crosscutting-concepts/i18n/react.md) | `use-intl`, catalogs and keys, ICU, formatting, language switch (shared: [i18n.md](../08-crosscutting-concepts/i18n/i18n.md)) | `REACT-I18N-*`, `I18N-*` |
| [08-crosscutting-concepts/testing/react.md](../08-crosscutting-concepts/testing/react.md) | Vitest projects, Testing Library with mocked contracts, slice and query tests, router tests, MSW, architecture canary, (React SPA) E2E behind the CSP server | `REACT-TEST-*` |
| [08-crosscutting-concepts/development/react-tooling.md](../08-crosscutting-concepts/development/react-tooling.md) | ESLint set for ESLint 10, React Compiler, tsconfig additions, scripts, bundle check, updates, wall-clock ban | `REACT-TOOL-*` |

Delivery of a React SPA is the shared model: the BFF serves the bundle (`REL-FE-*` in [container-runtime.md](../07-deployment-view/container-runtime.md)).

## Skills for React work

Load these when creating or editing React code (the `baseline-react` skill does this for you):

| Skill | For |
|---|---|
| `baseline-react` (own) | Entry point: docs to read, skills to load, overrides, workflow, templates |
| `vercel-react-best-practices` | React rendering and bundle performance |
| `tanstack-query-best-practices` | TanStack Query APIs and patterns |
| `material-ui-theming`, `material-ui-styling` (official MUI) | MUI theme, tokens, `sx` vs `styled` |
| `baseline-security` (own) | Security rules by task, review checklist |
| `baseline-i18n` (own) | Multilingual products |
| `accessibility` | WCAG 2.2 know-how |
| `vitest`, `playwright-best-practices`, `playwright-cli` | Tests and browser checks |
| `orval` | Generated API clients |
| `baseline-tdd` (own) | Test-first workflow |

**Where a skill and these docs disagree, the docs win** (TOOL-SKL-01). Known conflicts are listed in the "Skill overrides" table of each doc: [architecture](../05-building-block-view/react.md#skill-overrides-vercel-react-best-practices-tanstack-query-best-practices-generic-habits), [state](../08-crosscutting-concepts/ui/react-state-management.md#skill-overrides), [UI](../08-crosscutting-concepts/ui/react-mui.md#skill-overrides), [API clients](../08-crosscutting-concepts/api/react-openapi-clients.md#skill-overrides-orval-tanstack-query-best-practices), [security](../08-crosscutting-concepts/security/react.md#skill-overrides), [configuration](../08-crosscutting-concepts/configuration/react.md#skill-overrides), [observability](../08-crosscutting-concepts/observability/react.md#skill-overrides), [i18n](../08-crosscutting-concepts/i18n/react.md#skill-overrides), [testing](../08-crosscutting-concepts/testing/react.md#skill-overrides), [tooling](../08-crosscutting-concepts/development/react-tooling.md#skill-overrides), [TS testing](../08-crosscutting-concepts/testing/typescript.md#skill-overrides), [E2E](../08-crosscutting-concepts/testing/typescript-e2e.md#skill-overrides).

## Skill overrides

The most frequent ones:

| Habit | Baseline rule |
|---|---|
| `fetch` or a generated client in a component, `useEffect` to load data | TanStack Query whose `queryFn` calls a use case (REACT-ARCH-13, TS-ARCH-04) |
| Orval `react-query` client, RTK Query | Orval `fetch` client in `adapter/out/http`; RTK only for view state (REACT-D8, REACT-STATE-09) |
| One global slice holding backend data | Lazily injected feature slices with UI state only; backend data in the query cache (REACT-STATE-02/04) |
| Thunk that fetches or runs a command | `useMutation` whose `mutationFn` calls the use case from the feature's selector hook (REACT-STATE-03) |
| File-based routing, `.lazy()` route files, `React.lazy` routes | Code-based TanStack Router routes with `lazyRouteComponent` (REACT-ARCH-20/21) |
| Manual `useMemo`/`useCallback`/`memo` everywhere | React Compiler; manual memoization only when measured (REACT-ARCH-05) |
| Tailwind, shadcn/ui, hard-coded colours | MUI theme tokens (REACT-D5, REACT-UI-*) |
| Query `retry: 3`, query cache persisted to `localStorage` | Retries per REACT-STATE-15; no backend data in browser storage (TS-SEC-01) |
| `dangerouslySetInnerHTML`, `innerHTML` | Banned by lint (REACT-SEC-01..03) |
| `import.meta.env.VITE_*` for environment values | `/config.json` at runtime (REACT-CFG-*) |
| `npm create vite` | Template of `baseline-react` (REACT-ARCH-17) |
