# Proposal: React and Next.js frontend stacks

Status: **proposal, decisions D1–D12 made 2026-11-20** (D2 and D4 deviate from the recommendation; sections 2–11 still describe the recommended options there and are adjusted when the stack is implemented)

## 1. Goal and scope

Products can build frontends with React, either as a single-page app (React SPA, built with Vite) or with Next.js (App Router, server rendering). Both follow the same rules as Angular: the hexagonal frontend (TS-ARCH-*), framework-free core, generated clients (Orval, TS-API-*), zod for commands and responses (TS-D2), Vitest and Playwright (TS-D6/D7), WCAG 2.2 AA asserted by tests (A11Y-*), one build for all environments (CFG-*) and the npm supply-chain rules (TS-TOOL-11..16).

**Angular stays the default frontend.** React SPA and Next.js become documented alternatives (D1). A product records its choice in its chapter 4, as with choosing NestJS over Spring; no ADR is needed for choosing a documented stack. Next.js additionally needs a stated reason (public pages that need server rendering or SEO, first-paint budgets, streaming), because it changes the deployment topology (section 6).

Out of scope: React Native, Remix/React Router framework mode, Astro, micro-frontends.

## 2. Recommendation in brief

**One shared React layer, plus two delivery layers: `react-spa` (Vite) and `nextjs`.** The React layer holds everything both share (components, hooks, view state, server state, forms, UI library, i18n API, lint, component tests). The SPA layer keeps today's model: a static bundle served by the BFF (REL-FE-01 unchanged). The Next.js layer documents what is really different: server components, server actions, route handlers, the Node server, and Next.js acting as the BFF.

| Concern | Recommendation (React SPA and Next.js unless noted) |
|---|---|
| Build, router | SPA: Vite + TanStack Router, code-based routes (D3). Next.js: App Router (`src/app/`) |
| View state | Zustand vanilla stores, scoped per page or feature through a context provider (D4) |
| Server state | TanStack Query in the UI adapter, `queryFn` calls the use-case contract (D5) |
| UI components | MUI (Material UI) with a CSS-variables theme (D6) |
| Forms | React Hook Form + `standardSchemaResolver` with the command's zod schema (D7) |
| i18n | `use-intl` (SPA) / `next-intl` (Next.js): same ICU catalogs and API (D8) |
| API clients | Orval `client: 'fetch'` with a custom mutator (TS-API-03 unchanged; no `react-query` client) |
| Next.js runtime | Next.js is its own image and **is the BFF** for its browser users (D9) |

Why:

1. **The hexagon carries over without new concepts.** TS-ARCH-09 already sketches React wiring (composition file, context provider, `use<Feature>UseCases()` hooks). Hooks and components stay in `adapter/in/ui`; the core stays plain TypeScript.
2. **Each Angular-specific library has a mature React counterpart** that fits the same rule: the store calls use cases only (Zustand), the loader calls a use case (TanStack Query ≈ `resource()`), the form validates with the command's schema (RHF ≈ `validateStandardSchema`), Material Design components (MUI ≈ Angular Material).
3. **Next.js differences are real, not cosmetic.** Server components and server actions run on a server that holds the user's session, calls the backend and needs timeouts, health probes, logs and its own image. That is a backend concern in a frontend folder, so it gets its own files and rule prefix instead of footnotes in the React docs.

## 3. How the Angular pieces map

| Angular baseline | React SPA | Next.js | Notes |
|---|---|---|---|
| Angular CLI, `ng new` (NG-ARCH-17) | Vite + `@vitejs/plugin-react`, React Compiler on | `create-next-app`, Turbopack, React Compiler on | No `--ai-config`; the baseline's `AGENTS.md` replaces generated agent files |
| `app.config.ts` root composition | `src/app/app.tsx` + `src/app/providers.tsx` (QueryClient, theme, i18n, platform providers) | `src/app/layout.tsx` (server) + `src/app/providers.tsx` (`'use client'`) | `src/app/` stays the root composition (TS-ARCH-12 patterns unchanged) |
| `<feature>.providers.ts`, `InjectionToken`s (TS-ARCH-09/17) | `<feature>.composition.tsx`: provider component creating adapters and use cases once; `<feature>.tokens.ts`: `createContext` + `use<UseCase>()` hooks | Same on the client; plus `<feature>.composition.server.ts` (`import 'server-only'`), request-scoped through React `cache()` | Contexts are React types, so they live in the tokens file like Angular tokens |
| `provide<Feature>Api()` (TS-ARCH-19) | `<Feature>ApiProvider` exported from `index.ts` | Same; server side: `get<Feature>Api()` from the server composition | |
| `<feature>.routes.ts`, lazy `loadChildren` (TS-ARCH-20) | `<feature>.routes.tsx` with route definitions and zod search schemas; components through `lazyRouteComponent` | `src/app/**/page.tsx` are thin route files that render a page from the feature's `<feature>.pages.ts`; Next splits per route | TanStack Router needs the route tree statically for its types, so TS-ARCH-20 gets a variant (section 9) |
| Signals, `computed()`, `effect()` rules (NG-ARCH-06/08) | Function components, hooks; `useEffect` only to sync with external systems; derived values computed in render (Compiler memoizes) | Same in client components; server components have no hooks | Lint: react-hooks rules incl. compiler diagnostics |
| NgRx Signal Store (NG-STATE-*) | Zustand `createStore` per page/feature, provided by context | Same, client components only | D4 |
| `resource()` / `httpResource` (NG-ARCH-13) | TanStack Query `useQuery({ queryFn: ({ signal }) => useCase.load(id, signal) })` | Server components call use cases directly (`await`); client components use TanStack Query | D5; DTOs never in the cache |
| Signal Forms + `validateStandardSchema` (NG-ARCH-16) | React Hook Form + `standardSchemaResolver(CancelOrderInput)`; submit builds the command via `Command.of` | Same; a server action re-parses with the same schema | D7 |
| Angular Material + CDK, M3, `--mat-sys-*` (NG-UI-*) | MUI with `cssVariables: true`, one theme, own styles only through theme tokens | Same, plus `@mui/material-nextjs` cache provider | D6 |
| Transloco (NG-I18N-*) | `use-intl` | `next-intl` (RSC support, locale routing optional) | D8 |
| Orval `client: 'angular'`, interceptors | Orval `client: 'fetch'` + mutator in `platform/adapter/out/http` (base URL, XSRF header, 401 handling, timeout) | Client: same. Server: a second mutator that relays the access token from the session and sets timeouts | TS-API-03 already prescribes `fetch` for React |
| `untilAborted` helper (TS-API-06) | Not needed: `fetch` takes the `AbortSignal` directly | Same | |
| `ErrorHandler`, NG-OBS-* | Root error boundary + route `errorComponent` + `window` `error`/`unhandledrejection` listeners in `platform`, reporting adapter | `app/error.tsx`, `app/global-error.tsx`, `instrumentation-client.ts`; server: `instrumentation.ts` with `onRequestError` and OpenTelemetry | Same-origin report path (NG-OBS-03 equivalent) |
| `/config.json` + `RUNTIME_CONFIG` (NG-CFG-*) | Same: `/config.json` loaded and zod-parsed before the first render, exposed through a context | Server reads validated env at request time; root layout passes the public subset to a client provider. `NEXT_PUBLIC_*` banned for per-environment values (inlined at build, breaks CFG-02) | |
| CSP nonce templated by the BFF, Trusted Types (NG-SEC-05/06) | Same: the BFF templates the nonce into `index.html`; MUI/Emotion gets the nonce through its cache | `proxy.ts` (formerly `middleware.ts`) creates the nonce per request; pages using it render dynamically | Trusted Types support in React to verify (section 10) |
| XSRF interceptor (NG-SEC-07) | The fetch mutator adds `X-XSRF-TOKEN` to same-origin mutating calls | Server actions: Next's Origin/Host check plus `serverActions.allowedOrigins` pinned; route handlers: own CSRF check | |
| `@testing-library/angular`, harnesses (NG-TEST-*) | `@testing-library/react` + `user-event`, `renderWithProviders` that injects mocked use-case contracts | Same for client components; server components and actions tested as adapters (section 5) | |
| angular-eslint, `@ngrx/eslint-plugin` (NG-TOOL-02/03) | `eslint-plugin-react-hooks`, `@eslint-react/eslint-plugin`, `eslint-plugin-jsx-a11y`, `@tanstack/eslint-plugin-query` | plus `@next/eslint-plugin-next` | ESLint 10 support to verify (section 10) |
| Bundle budgets (NG-TOOL-05) | Size check on the Vite build output in `verify` | Same on `next build` output | |
| dependency-cruiser (TS-ARCH-12) | Same rules; `.tsx`; `fetch` is a global, so an ESLint `no-restricted-globals` outside `adapter/out/http` adds what dependency-cruiser cannot see | plus `server-only`/`'use client'` boundary rules | |
| Delivery: bundle in the BFF image (REL-FE-*) | Unchanged | Own Node image (`output: 'standalone'`), Next.js is the BFF | Section 6, D9 |

## 4. Libraries that can't be reused

Versions checked with `npm view` on 2026-11-20. React 19.3.1, Next.js 16.4.6, Vite 8.3.8, Orval 8.48.0, Vitest 5.1.1, zod 4.6.7. All candidates below are MIT unless noted.

### View state (replaces `@ngrx/signals`)

| Option | Version | Fit |
|---|---|---|
| **Zustand** | 5.1.0 | Small, typed, store = state + actions, like `withState` + `withMethods`. Vanilla `createStore` + context gives page/feature-scoped stores (NG-STATE-12). Selectors avoid re-renders. Middleware optional |
| Redux Toolkit | 2.15.0 | Mature, devtools, but one global store by default (against NG-STATE-12), more ceremony; RTK Query would bypass ports |
| Jotai | 3.0.2 | Atomic, good for derived state; no natural place for "methods that call use cases", scoping via `Provider` |
| TanStack Store | 0.11.2 | Still 0.x; small ecosystem |
| `useReducer` + context | React | No dependency; fine for small screens, no selectors, so larger trees re-render |

**Recommendation:** Zustand, with the NG-STATE rules translated (store in `adapter/in/ui`, actions call use-case contracts only, state is UI state, errors mapped once per feature, no cross-screen caching of backend data). Local component state stays in `useState`/`useReducer`.

### Server state (replaces `resource()` / `httpResource`)

| Option | Version | Fit |
|---|---|---|
| **TanStack Query** | 5.108.2 | Loading/error state, abort signal, deduplication, invalidation after mutations, SSR hydration for Next.js. `queryFn` calls the use case, so ports stay intact |
| Own `useResource` hook in `platform` | — | Mirrors Angular's `resource()` exactly, no cache; every product maintains it |
| SWR | — | Similar, smaller, weaker mutation model |

**Recommendation:** TanStack Query, **as a UI-adapter tool, not an API client**: Orval's `react-query` client stays banned (TS-API-03), query keys and functions live in the feature's UI adapter, the cache holds domain types returned by use cases, never DTOs. Its cache conflicts with NG-STATE-11 ("stores don't cache backend data across screens") and TS-ARCH-15 (caching in the outgoing adapter): the React rule allows the UI cache with a short default `staleTime` and invalidation after every command, and keeps N+1 coalescing in the adapter. A row component with its own `useQuery` is the React N+1 trap (API-N1-01).

### UI components (replaces Angular Material)

| Option | Version | A11y | M3 fit | Theming | Notes |
|---|---|---|---|---|---|
| **MUI (Material UI)** | 9.5.0 | Good, mature; complex widgets (Autocomplete, Select) need checks | Material Design family; M3 look needs theme work (M3 status not verified) | Theme object, CSS variables, dark mode, `sx` | Emotion runtime CSS needs the CSP nonce; MUI X date pickers and data grid community editions MIT (9.18.0), Pro/Premium paid |
| React Aria Components (Adobe) | 1.22.1, Apache-2.0 | Best in class, screen-reader tested, built-in i18n for dates and numbers | None (unstyled) | Own CSS with own M3 tokens | Most work: we build and maintain the styled `shared/ui` set |
| Base UI (MUI team, ex-Radix authors) | 1.9.0 | Good | None (unstyled) | Own CSS | Young but stable 1.x |
| Radix UI / shadcn/ui | radix-ui 1.8.1, shadcn 4.23.0 | Good primitives | None | Tailwind, code copied into the repo | Tailwind is excluded in the Angular baseline (NG-UI); copied code is unpinned and unscanned |
| `@material/web` (Google, M3 web components) | 2.5.0, Apache-2.0 | Medium in React (web components, events, forms) | Exact M3 | M3 tokens | Reported in maintenance mode by Google (verify); not recommended |

**Recommendation:** MUI, because it is the only option that ships ready Material components with theming and dark mode, so products look and behave like the Angular ones with little own widget code. React Aria Components is the alternative for products with their own design system or the strictest a11y needs. The `angular-material-design` skill is adapted into a `react-mui-design` skill (theme, tokens, size classes, navigation patterns).

### Forms (replaces Signal Forms)

| Option | Version | Fit |
|---|---|---|
| **React Hook Form** + `@hookform/resolvers` | 7.92.0 / 7.0.8 | Mature, uncontrolled inputs, `standardSchemaResolver` takes the zod schema from `ports/in` (TS-ARCH-06). MUI integration through `Controller` |
| TanStack Form | 1.33.5 | Standard Schema native, strong types; younger, smaller ecosystem |
| Conform | 1.21.3 | Built for server actions and progressive enhancement; only relevant for Next.js forms that must work without JavaScript |

**Recommendation:** React Hook Form in both. In Next.js a form either calls a use case on the client or posts to a server action; the action parses the same schema again.

### i18n (replaces Transloco)

| Option | Version | Fit |
|---|---|---|
| **`use-intl` / `next-intl`** | 4.15.1 / 4.15.3 | ICU MessageFormat native (NG-I18N-06), nested JSON catalogs (NG-I18N-02), typed keys, one API in SPA and Next.js, RSC support in `next-intl` |
| react-i18next + `i18next-icu` | 18.0.3 / 2.7.1 | Largest ecosystem, namespaces lazy-load like Transloco scopes; ICU only through a plugin; no first-class RSC story |
| react-intl (FormatJS) | 12.2.0, BSD-3-Clause | ICU native, extraction CLI; flat catalogs, heavier API |
| Lingui | 6.12.0 | Compile-time macros, PO catalogs; needs a compiler plugin in both builds |

**Recommendation:** `use-intl` for the SPA and `next-intl` for Next.js: same catalog format and API, so the I18N-* rules, Weblate format and test helpers are written once. Weblate support for the JSON format to confirm.

### SPA routing

| Option | Version | Fit |
|---|---|---|
| **TanStack Router** (code-based) | 1.170.46 | Type-safe params and search params, validated with zod at the boundary (TS-ARCH-06); loaders integrate with TanStack Query; route tree must be known statically, so only components and loaders are lazy |
| React Router (data mode) | 8.5.2 | Mainstream, `route.lazy` fits TS-ARCH-20 unchanged; params are untyped strings; frequent majors (v6 → v8) |

File-based routing (either router) is not used: it puts route files outside the feature folders.

### Other changes

- **Lint:** `eslint-plugin-react` (7.37.5, last release 2025-04) and `eslint-plugin-jsx-a11y` (6.10.2, last release 2024-10) declare peer support only up to ESLint 9, while ESLint is at 10.15.0. Proposed set: `eslint-plugin-react-hooks` 7.1.1 (peer includes ESLint 10), `@eslint-react/eslint-plugin` 5.30.5 instead of `eslint-plugin-react`, and `eslint-plugin-jsx-a11y` if it runs on ESLint 10 (otherwise the young fork `eslint-plugin-jsx-a11y-x` 0.2.0, which declares ESLint 10). jsx-a11y rules are errors (NG-TOOL-03 equivalent).
- **Unit test environment:** jsdom by default (as in Angular); Vitest browser mode (`vitest-browser-react` 2.3.0) as a later option.
- **Auth for the Next.js BFF:** `openid-client` 6.9.1 plus a server-side session store. Not Auth.js: `next-auth` latest is 4.24.15 and v5 is still `5.0.0-beta.32`. Not `iron-session` 9.1.0 alone: it keeps the session (and tokens) in an encrypted cookie, against "tokens stay server-side" (SPRING-SEC-32).

## 5. Hexagonal fit

### React (both)

- **Hooks only in adapters.** `domain`, `ports`, `application` import no `react`, no store, no query library (TS-ARCH-01 allow-list unchanged). Use cases stay plain classes or functions.
- **Composition per feature.** `orders.tokens.ts` creates one context per published contract and a hook that throws when the provider is missing. `orders.composition.tsx` creates adapters and use cases once (lazy `useState` initializer, platform dependencies from the platform context) and renders the providers. Only the app routes, `src/app/` and `index.ts` import it (rule `composition-root-not-imported`, unchanged).

```tsx
// features/orders/orders.tokens.ts (imports only ports and react)
export const LoadOrderHistoryContext = createContext<LoadOrderHistoryUseCase | null>(null);
export const useLoadOrderHistory = () => required(useContext(LoadOrderHistoryContext), 'LoadOrderHistory');

// features/orders/orders.composition.tsx
export function OrdersProvider({ children }: PropsWithChildren) {
  const { apiFetch } = usePlatform();
  const [uc] = useState(() => {
    const http = new HttpOrders(apiFetch);
    return { loadOrderHistory: new LoadOrderHistoryService(http), cancelOrder: new CancelOrderService(http, http) };
  });
  return (
    <LoadOrderHistoryContext value={uc.loadOrderHistory}>
      <CancelOrderContext value={uc.cancelOrder}>{children}</CancelOrderContext>
    </LoadOrderHistoryContext>
  );
}

// adapter/in/ui/order-history-page.tsx
const loadOrderHistory = useLoadOrderHistory();
const orders = useQuery({ queryKey: ordersKeys.history(), queryFn: ({ signal }) => loadOrderHistory.load(signal) });
```

- **Stores are created inside the page's provider** and call the use cases they receive; dependency-cruiser's `stores-only-call-use-cases` rule applies to `-store.ts`.
- **Tests** render the page inside a test provider with `vitest-mock-extended` mocks of the contracts (NG-TEST-04 equivalent).

### Next.js: where the boundaries blur, and the rules that restore them

Server components can `await` anything and server actions are public HTTP endpoints written as functions. Without rules, business logic and backend calls drift into `page.tsx`. Proposed rules (`NEXT-ARCH-*`):

1. **`src/app/` is the root composition and routing, nothing else.** `page.tsx`, `layout.tsx`, `route.ts` are thin: they read params, call the feature's page or handler, and contain no logic, no `fetch`, no generated client.
2. **Server components are incoming UI adapters.** They live in `features/<f>/adapter/in/ui/` (suffix `.server.tsx`), get use cases from the request-scoped server composition, and render. No business decisions (TS-ARCH-02), no DTOs.
3. **Server actions are incoming adapters** in `features/<f>/adapter/in/next/<f>-actions.ts` (`'use server'`). Each one: resolves the session and builds the `Caller`, parses input with the command's zod schema, builds the command through its factory, calls one use case, and returns a serializable result (`{ ok } | { errorCode }`, mapped like ARCH-UC-13). Every action is an entry point: authorized by the backend, rate-limited where needed, in the threat model (SEC-TM-02).
4. **Route handlers** are incoming adapters too (`adapter/in/next/`); used for the BFF endpoints (login, callback, logout, back-channel logout, API proxy, `/livez`, `/readyz`) and not for business APIs the backend already offers.
5. **Server-only code imports `server-only`**: the server composition, the session store, the server fetch mutator, configuration with secrets. Client entry points (`'use client'`) import neither these nor anything that does; the build fails if they do, and dependency-cruiser adds a rule from `\.client\.tsx$|'use client' files` (by naming convention) to `\.server\.tsx?$`.
6. **Nothing secret crosses to the client.** Props passed from server to client components are domain types or view models, never sessions, tokens or DTOs; the React taint APIs mark the session object.
7. **The core runs on both sides unchanged.** Ports and use cases are isomorphic plain TypeScript; only the composition differs (client provider vs server `cache()` factory).
8. **Waterfalls are the server-side N+1.** Sequential `await`s across nested server components get the same N+1 check (API-N1-01); the default fix is one use case per page that loads in parallel, or a view endpoint.

## 6. Delivery and the BFF

The baseline's model (REL-FE-01, NG-SEC-06/07, SPRING-SEC-08/09): the BFF does the OIDC login, holds the tokens, serves the SPA bundle from its own origin and sets the CSP with a per-request nonce.

**React SPA:** fits unchanged. Vite builds a static bundle; the BFF (Spring or NestJS) serves it under REL-FE-01..05; `/config.json` comes from the BFF (CFG-11); the chunk-reload rule (NG-ARCH-20) gets a React twin in the router's error handling.

**Next.js:** its server renders HTML with user data and calls the backend on behalf of the user. So it needs the user's access token, which only the BFF holds. Three topologies:

| Option | How | Trade-off |
|---|---|---|
| **A: Next.js is the BFF** (recommended) | `frontend/` is a deployable Node image. Next.js does the OIDC login (`openid-client`), keeps tokens in a server-side session store (Redis or Postgres), sets the `__Host-` session cookie, sets CSP and headers, relays the access token to the backend (resource server, SPRING-SEC-03). Client-side calls go through a route-handler proxy on the same origin | One origin, one hop. The Next.js image owns security-critical session code: needs the counterparts of SPRING-SEC-08/09/24/32/33, its own threat model and security tests. REL-FE-01 gets a documented alternative instead of an ADR |
| B: Next.js behind the Spring/Nest BFF | The BFF proxies HTML requests to the Next.js server and forwards the access token in a header | Two hops, token travels inside the cluster, two components share one session; complex and easy to get wrong |
| C: Static export embedded in the BFF | `output: 'export'`, served like the SPA | Keeps REL-FE unchanged, but no server components with data, no server actions, no proxy; dynamic routes need special deep-link handling. Then the React SPA is the simpler choice |

**Relation to the NestJS proposal (its D7: NestJS may be the BFF).** Both are Node BFFs with the same needs: OIDC with `openid-client`, server-side session store, `__Host-` cookie, CSRF, lifetimes, logout at the IdP, back-channel logout. These rules should be written once in a framework-neutral Node file (proposed `08-crosscutting-concepts/security/node-bff.md`, coordinated with the Node stack work, prefix to be agreed there), with `NEST-SEC-*` and `NEXT-SEC-*` adding only the framework wiring. A product with a NestJS backend and a Next.js frontend uses Next.js as the BFF and NestJS as a plain resource server.

Consequences of option A that the Next.js delivery doc must cover (`NEXT-REL-*`):

- Image per commit with `output: 'standalone'`, non-root, the `node` process directly (no `npm start`, so signals arrive); graceful shutdown and readiness on SIGTERM to verify for the standalone server.
- Read-only filesystem (REL-RUN-*): `.next/cache` (ISR, image optimization) needs a writable volume, a shared cache handler, or the features switched off. Default proposed: no ISR, `images.unoptimized` or an external image service.
- Rolling deployments (REL-FE-04, REL-ZD-04): previous release's static chunks kept, a fixed `deploymentId`, and a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` across instances; server-action IDs change per build, so a client on release N-1 calling an action on N fails and must reload once.
- Version tag: the Next.js component is its own release unit (`frontend/v…`, REPO-CI-05), not part of the backend's tag (REL-FE-05 does not apply).
- Probes, metrics, traces, logs: `/livez` and `/readyz` route handlers, OpenTelemetry via `instrumentation.ts`, pino JSON logs, timeouts on every server-side fetch (RES-TMO-01). These reuse the Node layer's rules where they exist.

## 7. Changes to the baseline

**Layering (D2):** three stack pages. `react` is shared; `react-spa` and `nextjs` each add to it and never contradict it, the same way `spring` adds to `java`.

**New files**

| File | Content | Rule IDs |
|---|---|---|
| `stacks/react.md`, `stacks/react-spa.md`, `stacks/nextjs.md` | Navigation, skills, skill overrides | — |
| `04-solution-strategy/react.md`, `react-spa.md`, `nextjs.md` | Stack at a glance, defaults | `REACT-D*`, `RSPA-D*`, `NEXT-D*` |
| `05-building-block-view/react.md` | Layout, naming, composition and tokens, components and hooks, data loading, forms, error boundaries, dependency-cruiser additions | `REACT-ARCH-*` |
| `05-building-block-view/react-spa.md` | Vite project, router and lazy routes, app shell, chunk reload, new app setup | `RSPA-ARCH-*` |
| `05-building-block-view/nextjs.md` | `src/app/` as composition, server and client composition, server components, server actions, route handlers, `proxy.ts`, `server-only`, rendering and caching defaults, new app setup | `NEXT-ARCH-*` |
| `08-…/ui/react-state-management.md` | Zustand stores, TanStack Query rules (keys, cache, invalidation, N+1) | `REACT-STATE-*` |
| `08-…/ui/react-mui.md` (name follows D6) | Theme, tokens, size classes, navigation, status messages, route focus, loading/empty/error states (mirrors NG-UI-*) | `REACT-UI-*` |
| `08-…/security/react.md` | `dangerouslySetInnerHTML` ban, URL schemes, ref DOM writes, Emotion nonce, fetch mutator XSRF and 401, Trusted Types | `REACT-SEC-*` |
| `08-…/security/nextjs.md` | BFF wiring (refers to the shared Node BFF rules), CSP nonce in `proxy.ts`, server actions as endpoints, allowed origins, taint, secrets never in client props, headers | `NEXT-SEC-*` |
| `08-…/configuration/react-spa.md`, `configuration/nextjs.md` | `/config.json` in the SPA; runtime env and public subset in Next.js, `NEXT_PUBLIC_*` ban | `RSPA-CFG-*`, `NEXT-CFG-*` |
| `08-…/observability/react.md`, `observability/nextjs.md` | Error boundaries and reporting; `instrumentation.ts`, probes, logs, traces | `REACT-OBS-*`, `NEXT-OBS-*` |
| `08-…/i18n/react.md`, `i18n/nextjs.md` | `use-intl` catalogs, keys, formatting, language switch; `next-intl` in RSC, locale detection | `REACT-I18N-*`, `NEXT-I18N-*` |
| `08-…/testing/react.md`, `testing/nextjs.md` | Testing Library, providers with mocked contracts, axe, router tests; server components, server actions, E2E with server-side stubbing | `REACT-TEST-*`, `NEXT-TEST-*` |
| `08-…/development/react-tooling.md`, `nextjs-tooling.md` | Lint set, React Compiler, scripts, bundle size; Next config, Turbopack, lint without `next lint` | `REACT-TOOL-*`, `NEXT-TOOL-*` |
| `08-…/resilience/nextjs.md` | Timeouts and retries for server-side calls | `NEXT-RES-*` |
| `07-deployment-view/nextjs-delivery.md` | Standalone image, read-only filesystem, skew, release unit, BFF topology | `NEXT-REL-*` |
| `skills/baseline-react/`, `skills/baseline-nextjs/` | Entry skills like `baseline-angular`: docs per task, skills to load, overrides, templates (tokens, composition, store, query, form, test provider, dependency-cruiser config) | — |
| `skills/react-mui-design/` | Own skill adapted from `angular-material-design` | — |

**Changed**

- All TypeScript docs: the framework-neutral split listed in section 8. `stacks/typescript.md`, `04-solution-strategy/typescript.md`: list all frontend stacks, not only Angular.
- `development/typescript-tooling.md`: **TS-TOOL-02** ties the browser matrix to Angular's supported browsers. Reword to "Baseline widely available at a date the baseline fixes" (currently Angular 22's date), applied through `browserslist` and Vite's `build.target` / Next.js's browserslist. TS-TOOL-04 lists the React and Next.js plugins.
- `05-building-block-view/typescript.md`: TS-ARCH-20 gets a variant for routers that need static route definitions (definitions static, components lazy, the routes file imports no adapter or composition); dependency-cruiser patterns accept `.tsx`.
- `api/typescript-openapi-clients.md`: TS-API-06's `untilAborted` marked Angular-only; a server-side mutator for Next.js (token relay, timeouts).
- `testing/typescript.md`: the stubbed E2E tier (TS-TEST-10) stubs in the browser; for Next.js, server-side backend calls need a stub too (D10).
- `i18n/i18n.md`, `configuration/configuration.md`, `10-quality-requirements/accessibility.md`: replace Angular-only wording with per-stack links.
- `07-deployment-view/container-runtime.md`: REL-FE-01 names the Next.js-as-BFF topology as documented alternative; `repository-layout.md`: `frontend/` may be a deployable Next.js image (REPO-LAY-03, REPO-CI-05).
- `security/spring.md` SPRING-SEC-09: the BFF may also be a Next.js or NestJS component.
- `04-solution-strategy/README.md`, `docs/baseline/README.md`: stack tables and prefixes.
- `AGENTS.md` (and the synced template): "Read by stack" rows for React SPA and Next.js with `baseline-react` / `baseline-nextjs`.
- `ARCHITECTURE.md`: Frontend, tests, code quality, i18n and entry-skill rows.
- `development/agent-skills.md`, `development/ide-setup.md`, skills `baseline-ide-setup`, `baseline-security`, `baseline-i18n`: React and Next.js routes and detection.
- `11-risks-and-technical-debt/README.md`: checks before first use (section 10); `12-glossary`: server component, server action, route handler, hydration.

**Third-party skills to evaluate** (pinned and reviewed, TOOL-SKL-02/03; candidates only): Vercel's React and Next.js best-practice skills (`vercel-labs/agent-skills`), Next.js upgrade and cache skills, a TanStack Query skill, MUI's MCP server for docs lookup. Expected overrides: data fetching directly in components or server components, server actions writing to databases, Tailwind/shadcn defaults, file-based routing, `react-query` Orval clients, `NEXT_PUBLIC_*` for environment values.

## 8. Load only your stack (design principle)

A project loads the shared docs plus its own stack chain, nothing else. Stack files add to the layer below; they never require reading a sibling stack.

| Project | Reads | Never loads |
|---|---|---|
| Angular | shared + `typescript` + `angular` | React, Next.js docs and skills |
| React SPA | shared + `typescript` + `react` + `react-spa` | Angular, Next.js |
| Next.js | shared + `typescript` + `react` + `nextjs` | Angular, React SPA |

**Rules for writing the docs**

- Shared and `typescript` files are framework-neutral: no framework examples, no inline links to stack rules. Where a mechanism differs per stack, the file ends with one short "Per stack" line pointing to `stacks/<stack>.md`.
- Each stack file carries its own examples, dependency-cruiser additions and skill overrides.
- Entry skills load only their chain: `baseline-angular` (unchanged), `baseline-react` (TypeScript + React docs, `vitest`, `playwright-best-practices`, `orval`, `accessibility`, `baseline-tdd`, React third-party skills), `baseline-nextjs` (everything of `baseline-react` except the `react-spa` docs, plus Next.js docs and skills). Third-party skills belong to exactly one stack; `baseline-security` and `baseline-i18n` route by stack and read only the matching rows.

**Moves needed in today's TypeScript docs** (rule IDs stay; only text and examples move)

| File | Moves to the Angular files |
|---|---|
| `05-building-block-view/typescript.md` | Title "(Angular / React / Vue)"; `.providers.ts` in the layout and concept table (neutral: "composition file, name per stack"); TS-ARCH-03/18/19 Angular links and `provide<Feature>Api()`; TS-ARCH-06 `validateStandardSchema`/NG-ARCH-16 example; TS-ARCH-08 `resource()` example; TS-D1 "Why" (`resource()` loaders, `untilAborted`); TS-ARCH-09 Angular, React and Vue paragraphs (each to its stack file; Vue dropped); dependency-cruiser entries with `@angular/common/http`, `app.config.ts`, `\.providers\.ts` and the NG-ARCH-04 comment (stack files add their own block) |
| `development/typescript-tooling.md` | TS-TOOL-02 rewritten neutral: browsers = Baseline widely available at a date the baseline fixes (today Angular 22's 2026-05-07, `ES2023`); the Angular CLI `browserslist` and "re-check on every Angular major" go to NG-TOOL; TS-TOOL-04's framework plugins and TS-TOOL-15's NG-TOOL-06 reference go to stack tooling; Angular browser-support source |
| `api/typescript-openapi-clients.md` | `client: 'angular'` config example, TS-API-03's per-framework list (neutral: "a client whose calls pass the platform HTTP stack; no query-library clients"), TS-API-04 "provided in root" wording, TS-API-06 `untilAborted` and the `HttpOrders`/`useExisting` example, the `angular-query` skill-override row → a new `api/angular-openapi-clients.md` (rule IDs unchanged) |
| `testing/typescript.md`, `testing/typescript-e2e.md` | Angular override rows; NG-TEST-08, NG-UI-09/20 references (size classes cited from the shared UI rules below) |
| `security/typescript.md` | Intro "TypeScript in Angular"; TS-SEC-05's link to NG-OBS-06 becomes "per stack" |
| `i18n/i18n.md` | Transloco in the defaults and test tables, `@angular/localize`, NG-ARCH-18, NG-I18N-03/11, NG-UI-25, "pure Angular pipe" → `i18n/angular.md`; shared text says "the stack's i18n library" |
| `10-quality-requirements/accessibility.md`, `07-deployment-view/container-runtime.md` | NG-UI/NG-SEC/NG-CFG references in A11Y-20..22 and REL-FE-01/02 → "the stack's rule" plus the per-stack line |
| `ui/angular-material.md` | Framework-neutral rules (size classes, navigation by window size, 4/8 grid, logical properties, viewport units, hover, input attributes, print, status messages, route title and focus, loading/empty/error states: NG-UI-09..11, 19..33, 35) are lifted into a new shared `ui/ui-patterns.md` with `UI-*` IDs. The NG-UI rules keep their IDs, shrink to the Angular mechanism and cite the UI rule. React and Next.js then only add `REACT-UI-*` mechanisms |

**Sync and routing (D12).** Skill descriptions sit in every agent session, so unused stacks cost tokens even when their docs are never opened. Proposed: the project declares its stacks once (`--stacks angular,spring` on the first sync, stored in a small `.baseline.json` and reused). The sync then copies only those stacks' skills and writes only their rows into the "Read by stack" table of `AGENTS.md`. All docs are still synced (unread files cost nothing, and cross-links keep working); syncing only declared docs is an option in D12.

## 9. Rules that need a deliberate variant

| Shared rule | Issue | Proposal |
|---|---|---|
| TS-ARCH-20 (routes only via dynamic `import()`) | TanStack Router needs the route tree statically; Next.js routes are files in `src/app/` | Variant: route definitions may be static if they import only router, zod and dynamic imports; Next.js: route files render pages from `<feature>.pages.ts` |
| NG-STATE-11 / TS-ARCH-15 (no UI caching) | TanStack Query is a cross-screen cache | React rule: allowed for use-case results, short `staleTime`, invalidation after commands, no DTOs |
| REL-FE-01..05 | Next.js is a server | Documented alternative topology (section 6) |
| CFG-11 (`/config.json`) | Next.js renders on the server | Same intent: runtime values from the serving server; `NEXT_PUBLIC_*` banned for them |
| TS-TEST-10 (stubbed tier stubs at the browser) | RSC and actions call the backend server-side | Stub at the server's outgoing boundary too (D10) |
| NG-SEC-06 (nonce templated into `index.html`) | Next.js pages are rendered, not templated | Nonce from `proxy.ts`; pages that need it render dynamically; static pages only without inline scripts |

## 10. Risks and things to verify before adoption

- **ESLint 10 support of React lint plugins.** `eslint-plugin-react` and `eslint-plugin-jsx-a11y` have had no release since 2025-04 and 2024-10 and declare ESLint ≤ 9. Test them on ESLint 10 before relying on them; the a11y lint layer (A11Y-*) must not be weakened (SEC-REV-02).
- **Next.js 16 specifics** named here from its documentation: `proxy.ts` replacing `middleware.ts`, Cache Components (`'use cache'`), `next lint` removed, Turbopack as default, standalone server signal handling. Re-check each against the pinned version.
- **Next.js release pace and coupling.** Next.js majors change caching and rendering defaults often; most docs and skills assume Vercel hosting. Self-hosting rules (cache handler, skew, image optimization) need a sample deployment on a customer-like platform.
- **CSP with Next.js.** A nonce forces dynamic rendering of the page; MUI/Emotion needs the nonce too. Verify a strict nonce CSP with `'strict-dynamic'` works end to end, and whether React 19 supports `require-trusted-types-for 'script'` (NG-SEC-05 equivalent).
- **Next.js as BFF** is security-critical code without Spring Security. Threat model (SEC-TM-02) and security tests before adoption; shared with the NestJS BFF work.
- **Testing server components.** Testing Library cannot render async server components. Keep them thin, test use cases and client components, and cover RSC pages in E2E. The stubbed E2E tier needs a server-side stub (MSW in the Next.js process in test mode, or a mock server from the spec).
- **MUI and Material Design 3.** Confirm MUI 9's M3 status and the effort for an M3 theme, its a11y record on complex widgets, and Emotion's CSP nonce handling; MUI X Pro/Premium licences only by ADR.
- **`use-intl` / `next-intl` with Weblate**: confirm the nested JSON + ICU format, plural checks and the pseudo-locale workflow.
- **TanStack Router** typed routes across lazy feature folders: confirm code-based routes keep the main bundle small and dependency-cruiser can enforce the variant of TS-ARCH-20.
- **Three frontend stacks to maintain.** Every frontend rule change then touches up to four files. Budget for it, or adopt React SPA first and Next.js later (phases).

## 11. Phases

0. **Split first (useful even without React):** the moves of section 8, `ui/ui-patterns.md`, and the stack declaration in the sync (D12). Angular projects get smaller, framework-neutral TypeScript docs.
1. **React foundation:** D1–D8 decided; `react` and `react-spa` layers: solution strategy, building blocks with dependency-cruiser additions, tooling, testing, state, UI, security, configuration, observability; `baseline-react` skill with templates; a sample feature built test-first.
2. **React i18n and UI depth:** `use-intl` rules, `react-mui-design` skill, the full NG-UI-* counterpart set, a11y E2E parity.
3. **Next.js:** D9–D11 decided; `nextjs` layer; shared Node BFF rules with the NestJS work; `baseline-nextjs` skill; sample deployment with BFF, nonce CSP, rolling update and E2E stubbing.

## 12. Decisions

Decisions D1–D12 made 2026-11-20.

| # | Decision | Decided |
|---|---|---|
| D1 | Which React stacks the baseline supports | React SPA (Vite) and Next.js, both as documented alternatives to Angular |
| D2 | Layering and rule prefixes | Two layers: `react` (REACT-*) with the SPA defaults, and `nextjs` (NEXT-*) on top **(deviates)**. Next.js differences still live in their own files; where Next.js replaces an SPA default (router, build, `/config.json`, delivery) the `react` rule names its scope ("React SPA") so Next.js never contradicts a rule that applies to it |
| D3 | React SPA build and router | Vite + TanStack Router (code-based) |
| D4 | View-state library | Redux Toolkit **(deviates)**: slices per feature as view state of the UI adapter; thunks or listeners call use cases through the injected contracts, never HTTP or generated clients; server data stays in TanStack Query (D5), not in the store |
| D5 | Server-state library | TanStack Query in the UI adapter, `queryFn` calls use cases |
| D6 | UI component library | MUI with CSS-variables theme |
| D7 | Forms | React Hook Form + `standardSchemaResolver` |
| D8 | i18n | `use-intl` (SPA) / `next-intl` (Next.js) |
| D9 | Next.js deployment and BFF role | Next.js is its own image and the BFF (shared Node BFF rules with NestJS) |
| D10 | Stubbed E2E tier for Next.js | MSW inside the Next.js server in test mode, using Orval's handlers |
| D11 | Next.js rendering and caching default | Dynamic rendering by default; static or cached only for public pages without personal data or nonce needs |
| D12 | Loading only the declared stacks | Project declares its stacks (`.baseline.json`); sync copies all docs but only those stacks' skills, and `AGENTS.md` routes only to them |

### Original options

| # | Decision | Options (recommended first) |
|---|---|---|
| D1 | Which React stacks the baseline supports | **React SPA (Vite) and Next.js, both as documented alternatives to Angular** · React SPA only: smallest change, no new topology · Next.js only: one React option, but every React product then runs a Node server |
| D2 | Layering and rule prefixes | **Three layers: `react` (REACT-*), `react-spa` (RSPA-*), `nextjs` (NEXT-*)** · Two layers, `react` with SPA defaults and `nextjs` overriding them: fewer files, breaks "add, never contradict" · One `react` layer with Next.js sections: differences not explicit |
| D3 | React SPA build and router | **Vite + TanStack Router (code-based)**: typed params, zod search validation, needs a TS-ARCH-20 variant · Vite + React Router (data mode): mainstream, fits TS-ARCH-20 as is, untyped params |
| D4 | View-state library | **Zustand, scoped stores via context** · Redux Toolkit: mature, global by default, more ceremony · Jotai: atomic, no natural home for use-case calls · `useReducer` + context only: no dependency, re-render cost |
| D5 | Server-state library | **TanStack Query in the UI adapter, `queryFn` calls use cases** (UI cache allowed with rules) · Own `useResource` hook in `platform`: mirrors Angular `resource()`, no cache, own maintenance · SWR: smaller, weaker mutations |
| D6 | UI component library | **MUI with CSS-variables theme**: ready Material components, closest to Angular Material · React Aria Components + own M3 styling: best a11y, most own code · Base UI + own styling: unstyled, young · shadcn/ui: Tailwind and copied code, conflicts with current UI rules |
| D7 | Forms | **React Hook Form + `standardSchemaResolver`** · TanStack Form: Standard Schema native, younger · Conform: only for progressive-enhancement server-action forms |
| D8 | i18n | **`use-intl` (SPA) / `next-intl` (Next.js)**: one ICU catalog format and API · react-i18next + `i18next-icu`: biggest ecosystem, ICU via plugin, weak RSC story · react-intl: ICU native, flat catalogs · Lingui: compiler macros in both builds |
| D9 | Next.js deployment and BFF role | **Next.js is its own image and the BFF** (shared Node BFF rules with NestJS) · Next.js server behind the Spring/Nest BFF: two hops, token forwarding · Static export inside the BFF: REL-FE unchanged, no server features |
| D10 | Stubbed E2E tier for Next.js | **MSW inside the Next.js server in test mode, using Orval's handlers** · Mock server generated from the spec (e.g. Prism) as a separate process · Only browser-side stubbing plus the smoke tier: server-rendered paths untested on PRs |
| D11 | Next.js rendering and caching default | **Dynamic rendering by default; static or cached (`'use cache'`) only for public pages without personal data or nonce needs** · Static and cached by default: faster, but nonce CSP and per-user data need opt-outs everywhere |
| D12 | Loading only the declared stacks | **Project declares its stacks (`.baseline.json`); sync copies all docs but only those stacks' skills, and `AGENTS.md` routes only to them** · Also sync only the declared stacks' docs: smallest footprint, broken cross-links and a re-sync when a stack is added · Status quo, sync everything and rely on routing: every session carries all skill descriptions |
