# Next.js: Architecture and Project Structure

How the hexagonal frontend ([typescript.md](typescript.md), TS-ARCH-*) and the React rules ([react.md](react.md), REACT-ARCH-*) are built with the Next.js App Router, where part of the UI adapter runs on the server and the app is also the BFF. Every REACT-ARCH rule applies unless it is marked "(React SPA)"; the rules below replace those and add the server side. Defaults: [04-solution-strategy/nextjs.md](../04-solution-strategy/nextjs.md) (NEXT-D*). Security of the server side (sessions, `proxy.ts`, server actions as endpoints): [security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md); server-side API clients: [api/nextjs-openapi-clients.md](../08-crosscutting-concepts/api/nextjs-openapi-clients.md).

## Project layout

```
next.config.ts  orval.config.ts  eslint.config.ts  vitest.config.ts  playwright.config.ts  .dependency-cruiser.cjs  Dockerfile
messages/                       ← en.json, de.json (next-intl catalogs)
scripts/check-bundle.mjs        ← bundle gate in `verify` (NEXT-TOOL-08)
src/
  proxy.ts                      ← per-request nonce, CSP and security headers, server-action origin gate (NEXT-ARCH-11)
  instrumentation.ts            ← server: OpenTelemetry, onRequestError, test stubs (NEXT-OBS, NEXT-D5)
  instrumentation-client.ts     ← browser, before app code: z.config({ jitless: true }), Trusted Types default policy
  telemetry.ts  backend-stubs.ts ← imported only by instrumentation.ts: OpenTelemetry SDK; MSW stubs in test mode
  app/                          ← routing and root composition only (NEXT-ARCH-01)
    layout.tsx                  ← root layout: nonce, locale, public config → <Providers>, <AppShell>
    providers.tsx               ← 'use client': Emotion cache with nonce, theme, public config, store, QueryClient
    app-shell.tsx  theme.ts     ← skip link, banner, navigation, <main>; MUI theme
    page.tsx  orders/page.tsx   ← one-line re-exports of a feature pages file
    api/[...path]/route.ts      ← binds the platform's API proxy (browser → backend, token relay)
    auth/{login,callback,logout}/route.ts  client-errors/route.ts  livez/route.ts  readyz/route.ts   ← bind platform handlers
  platform/                     ← same rings and rules as a feature (REACT-ARCH-04)
    domain/                     ← Caller, TechnicalError, UnauthenticatedError
    ports/in/ ports/out/ application/   ← session, API-relay and client-error intake use cases; session store, IdP, backend-relay, client-error log ports
    adapter/in/next/            ← route handlers (auth, API proxy, client errors, health), security headers, CSRF check
    adapter/in/ui/              ← store.ts (combineSlices), store-provider.client.tsx, public-config.client.tsx
    adapter/in/i18n/request.ts  ← next-intl request config
    adapter/out/http/           ← browser-fetch.ts, server-fetch.ts (Orval mutators), fetch-backend-relay.ts
    adapter/out/{oidc,session,logging}/   ← openid-client, Redis session store (sessions, pre-login records, refresh lock), pino
    config/                     ← server-config.ts (zod, server-only), public-config.ts
    platform.composition.server.ts   ← server singletons (Redis, OIDC), route handlers, configureServerFetch()
    index.ts  index.client.ts  index.server.ts   ← the three entry points (NEXT-ARCH-14)
  features/
    orders/
      domain/  application/  ports/in/  ports/out/     ← isomorphic core (NEXT-ARCH-08)
      adapter/in/ui/            ← orders-screen.server.tsx, orders-panel.client.tsx, cancel-order-form.client.tsx,
                                  orders-view.slice.ts, orders-queries.ts, orders-error-keys.ts
      adapter/in/next/          ← orders-actions.ts ('use server'), cancel-order.handler.ts (action body, NEXT-TEST-06)
      adapter/out/http/         ← http-orders.ts, orders-http.browser.ts, orders-http.server.ts, mappers, generated/
      adapter/out/next/         ← server-action-orders.ts (browser side of the server action)
      orders.tokens.ts          ← OrdersUseCases type, the feature's one context, selector hooks (REACT-ARCH-09)
      orders.api.tsx            ← 'use client': createOrdersUseCases() (browser adapters, use cases), <OrdersApiProvider>
      orders.composition.tsx    ← 'use client': slice injection, the API provider around the page (NEXT-ARCH-15)
      orders.composition.server.ts ← server-only: server adapters and use cases per request (cache)
      orders.pages.ts           ← page and metadata for src/app/orders/page.tsx; wires server use cases
      index.ts                  ← public API (TS-ARCH-19): re-exports orders.api.tsx and the published hooks; never pages
  shared/ui/                    ← formatting, presentational components
  testing/                      ← render-with-providers.tsx
test/                           ← architecture.spec.ts, fixtures/arch-violation/
e2e/                            ← stubbed-server.ts (built standalone server in test mode), fixtures.ts, *.spec.ts
```

## Rules

### Routing and composition

- **NEXT-ARCH-01: `src/app/` holds routing and the root composition, nothing else.** Replaces REACT-ARCH-20, REACT-ARCH-23 and REACT-ARCH-24 for Next.js. Route files (`page`, `layout`, `route`, `loading`, `error`, `not-found`, `template`, `default`) are thin: a `page.tsx` re-exports a page and its metadata from the feature's `<feature>.pages.ts`; a `route.ts` binds a handler from `@/platform/index.server`. The root `layout.tsx` is the bootstrap: it reads the nonce (set by `proxy.ts`) and the locale, sets `<html lang>` (A11Y-32), and renders `NextIntlClientProvider`, the client `Providers` (with the nonce and the public config, NEXT-D7) and the `AppShell` (skip link, banner, navigation, `main`; UI-16 and A11Y-21 as in the React rules). The pages file is the Next.js form of TS-ARCH-20: the App Router splits code per route, so `page.tsx` imports it statically; only `src/app` imports a pages file, and `index.ts` never exports pages. Chunk and server-action skew after a release are handled in delivery ([nextjs-delivery.md](../07-deployment-view/nextjs-delivery.md)), which replaces REACT-ARCH-21. Enforced by `app-route-files-are-thin` and `feature-pages-only-from-app` (NEXT-ARCH-13).

```ts
// src/app/orders/page.tsx
export { OrdersPage as default, generateOrdersMetadata as generateMetadata } from '@/features/orders/orders.pages';

// src/app/auth/login/route.ts
import { authRouteHandlers } from '@/platform/index.server';
export const GET = authRouteHandlers.login;
```

### Server side: incoming adapters

- **NEXT-ARCH-02: Server components are UI adapters.** They live in `adapter/in/ui` with the suffix `.server.tsx`, are `async`, receive the use-case contract as a **prop** from the pages file (server components cannot read React context), call it, and render. They never call `fetch`, a generated client, an outgoing port or a database (NEXT-D4, TS-ARCH-04/08). They translate with `getTranslations` from `next-intl/server`, turn `UnauthenticatedError` into `redirect('/auth/login?returnTo=…')`, let other errors reach the route's `error.tsx` ([observability/nextjs.md](../08-crosscutting-concepts/observability/nextjs.md)), and pass domain data to client components as props (NEXT-ARCH-16). Route input is untrusted: the pages file awaits `params` and `searchParams` and parses them with a zod schema with defaults before use (replaces REACT-ARCH-19 for Next.js; to verify before first use, the validation app has no route parameters).

```tsx
// features/orders/orders.pages.ts (.ts: the pages file builds elements with createElement, it holds no JSX)
export function OrdersPage(): ReactNode {
  return createElement(
    OrdersComposition, // client composition: browser use cases for the client components below
    null,
    createElement(OrdersScreen, { listOrders: ordersServerUseCases().listOrders }),
  );
}

// features/orders/adapter/in/ui/orders-screen.server.tsx
export async function OrdersScreen({ listOrders }: { readonly listOrders: ListOrdersUseCase }): Promise<ReactNode> {
  const [t, orders] = await Promise.all([getTranslations('orders'), loadOrders(listOrders)]); // no waterfall (NEXT-ARCH-09)
  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>{t('title')}</Typography>
      <OrdersPanel initialOrders={orders} />
    </>
  );
}
```

- **NEXT-ARCH-03: Each feature has a server composition, `<feature>.composition.server.ts`, that starts with `import 'server-only'` and creates its server adapters and use cases once per request with React `cache()`.** The exported function (`ordersServerUseCases`) is called at use, never at import: `next build` evaluates route modules without the runtime environment. Process-wide resources (Redis client, OIDC discovery, logger) belong to the platform's `platform.composition.server.ts`, created lazily at first use and memoized at module level; they hold no per-request or per-user state. A server composition never keeps anything user-specific at module level. Outside a server component render (in a server action or a route handler) `cache()` does not memoize, so each call creates fresh instances; that is correct, only slower.

```ts
// features/orders/orders.composition.server.ts
import 'server-only';
import { cache } from 'react';

/** Server composition of the feature: one set of adapters and use cases per request (React `cache`). */
export const ordersServerUseCases = cache((): OrdersServerUseCases => {
  const http = createServerHttpOrders(); // generated server client + server mutator (NEXT-API-*)
  return { listOrders: new ListOrdersService(http), cancelOrder: new CancelOrderService(http) };
});
```

- **NEXT-ARCH-04: Server actions are incoming adapters in `adapter/in/next/<feature>-actions.ts`, a `'use server'` file, one use case per action.** An action takes `input: unknown`, resolves the caller from the session (`currentCaller()` from `@/platform/index.server`, never from the input), parses the input with the command's zod schema with `.strict()`, builds the command through its factory, calls one use case and returns a result union `{ ok: true } | { ok: false, errorCode }`. Expected errors become codes, because Next.js replaces thrown errors with a generic message in production; unexpected errors are rethrown and reach `onRequestError`. Actions never rely on encrypted bound arguments or closures for security; every action is a public `POST` endpoint ([security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md)). Actions cannot receive dependencies, so an actions file may import its own feature's `<feature>.composition.server.ts`: this is the one stated exception to `composition-root-not-imported` (NEXT-ARCH-13). A `TechnicalError` becomes `TECHNICAL` without a log line: the server mutator or the server HTTP adapter that created it logged it (NEXT-OBS-09). On the client a server action is an outgoing call: the feature's `adapter/out/next/` adapter implements the outgoing port, receives the action and the `ReportErrorUseCase` from the client composition, maps the codes back to domain errors in one place and reports the `TechnicalError`s it creates, once: a call that returns no result and `INVALID_INPUT` (this app sent what its own action refuses). `TECHNICAL` becomes a `TechnicalError` that is not reported again, because the server logged that failure (TS-ARCH-18). Components never import an action; they call the use case like any other (REACT-ARCH-07).

```ts
// features/orders/adapter/in/next/orders-actions.ts
'use server';

export async function cancelOrderAction(input: unknown): Promise<CancelOrderActionResult> {
  const caller = await currentCaller();
  if (!caller) return { ok: false, errorCode: 'UNAUTHENTICATED' };
  const parsed = CancelOrderCommandSchema.strict().safeParse(input); // unknown keys fail
  if (!parsed.success) return { ok: false, errorCode: 'INVALID_INPUT' };
  try {
    await ordersServerUseCases().cancelOrder.cancelOrder(CancelOrderCommand.of(parsed.data));
    return { ok: true };
  } catch (error) {
    return { ok: false, errorCode: errorCodeOf(error) }; // known domain errors → codes; others rethrown inside
  }
}

// features/orders/orders.api.tsx ('use client'): the browser factory (REACT-ARCH-10)
cancelOrder: new CancelOrderService(new ServerActionOrders(cancelOrderAction, reportError)),
```

- **NEXT-ARCH-05: Route handlers are incoming adapters of the platform: BFF endpoints, the API proxy and probes.** The handlers live in `src/platform/adapter/in/next/`, are created by `platform.composition.server.ts` and call platform use cases (session, API relay, client-error intake), never an outgoing port or `fetch` directly; `src/app/**/route.ts` only binds them (NEXT-ARCH-01). The set is fixed: `/auth/login`, `/auth/callback`, `/auth/logout`, `/api/[...path]` (proxy to the backend with token relay, [api/nextjs-openapi-clients.md](../08-crosscutting-concepts/api/nextjs-openapi-clients.md)), `/client-errors` (the browser's error reports, [NEXT-OBS-18](../08-crosscutting-concepts/observability/nextjs.md)), `/livez`, `/readyz`, and where adopted the CSP report and back-channel logout endpoints. `isRouteHandlerPath()` in `security-headers.ts` lists the same prefixes: `proxy.ts` gives them the API CSP and leaves their origin checks to the handlers (NEXT-SEC-05). Features expose no REST endpoints of their own: the backend owns the API (API-CON-*), the app relays it. In the validation project the first proxy version called the outgoing relay port directly; `ui-no-outgoing-ports` caught it and the `ApiRelayService` use case was added.

### Client boundary

- **NEXT-ARCH-06: Server-only code is marked with `import 'server-only'`, client code with `'use client'`, and both are visible in the file name.** Every server-only module starts with `import 'server-only'`: server compositions, the server mutator, server HTTP adapters (`*.server.ts`), `platform/index.server.ts`, server configuration. A client bundle that reaches one fails `next build`. `'use client'` appears only in files with the suffix `.client.tsx`, in client compositions (`<feature>.composition.tsx`), in the feature API file (`<feature>.api.tsx`, REACT-ARCH-11) and in the root client files `src/app/providers.tsx`, `app-shell.tsx`, `theme.ts`; `'use server'` only in `adapter/in/next/*-actions.ts`. Suffixes in addition to REACT-ARCH-02: `.server.tsx` (server component), `.server.ts` (server-only module), `.client.tsx` (client component), `.composition.tsx` (client composition), `.api.tsx` (published feature API, a client file), `.composition.server.ts` (server composition), `.pages.ts` (pages file), `-actions.ts` (server actions), `.browser.ts` (browser-only adapter factory). The suffixes exist because dependency-cruiser cannot read directives (NEXT-ARCH-13); ESLint enforces the directive-to-suffix match (NEXT-TOOL-06).
- **NEXT-ARCH-07: Nothing secret crosses to the client.** Props passed from a server component to a client component, and the return values of server actions, are serialized into the HTML and the RSC payload. They carry only what the UI shows: domain data mapped by the adapter (never DTOs with internal fields) and the public configuration subset (NEXT-D7); text is translated on each side, never passed across (NEXT-I18N-07). Never tokens, session ids, server configuration, secrets or error details. Taint APIs and the review checks are in [security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md).
- **NEXT-ARCH-08: The core is isomorphic.** `domain`, `ports` and `application` import nothing from `next`, `react`, `server-only`, `next-intl` or Node.js built-ins, so the same use-case class runs on the server with the server adapter and in the browser with the browser adapter (`ListOrdersService` in both compositions of the validation project). Server/client differences live only in adapters and compositions. Domain types that cross the boundary as props are plain readonly data (TS-ARCH-16), not class instances with methods, because the RSC payload drops prototypes.

### Data loading and rendering

- **NEXT-ARCH-09: Server-side waterfalls are N+1 problems** (API-N1-01). Typical Next.js traps: sequential `await`s in one server component, nested async server components that each wait for their parent's data, and a server component per row that calls a use case. Fix independent loads with `Promise.all` (S6); per-row loads with a view or batch endpoint (S1, S2) and request coalescing in the outgoing adapter (S4, TS-ARCH-15). React `cache()` deduplicates identical calls within one request but never batches different ones. Recommend a strategy; the developer decides (API-N1-02).
- **NEXT-ARCH-10: Rendering is dynamic by default** (NEXT-D3). The root layout reads `headers()` for the nonce, so every route renders per request (`ƒ` in the `next build` output; verified). A page may be static or cached only when it is public, holds no personal data and needs no nonce, and only with an ADR that covers its CSP (NEXT-RES-07). Pages with personal data never use `export const dynamic = 'force-static'`, `revalidate`, `'use cache'`, `unstable_cache` or `fetch` cache options. Cache Components (`cacheComponents`) and Partial Prefetching need an ADR. Static public pages were not built in the validation project: to verify before first use, including how they get their CSP.
- **NEXT-ARCH-11: `src/proxy.ts` sets the per-request nonce, the CSP and security headers, and gates writes to page paths (server actions); it holds no business logic.** It exports `proxy(request)` and `config.matcher` (Next.js 16 renamed `middleware.ts`; that file name is not used). It never calls a backend, a use case other than the session, or a database, and never renders. Its security content (nonce, headers, the origin gate for page writes, session handling): [security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md).

## New app

- **NEXT-ARCH-12: A new app starts from the template of the `baseline-nextjs` skill, not from `create-next-app`.** `create-next-app` brings Tailwind, a different tsconfig and lint set, the Pages-or-App choice, an `AGENTS.md` of its own and agent feedback. Replaces REACT-ARCH-17 for Next.js. Steps: copy the template into the component folder (`frontend/`, REPO-TOOL-03), rename the example feature, point `orval.config.ts` at the backend's spec (TS-API-01), run `npm ci` and `npm run verify`, then sync the baseline into the repository. The template contains:
  - `package.json` with exact pins, `engines` (`node >=26.0.0`, `npm >=11.10.0`), the scripts of NEXT-TOOL-07, `.npmrc` (TS-TOOL-11), `.nvmrc` `26`;
  - `next.config.ts` (NEXT-TOOL-01), `tsconfig.json` (NEXT-TOOL-03), `eslint.config.ts` (NEXT-TOOL-05/06), `.dependency-cruiser.cjs` with the canary (NEXT-ARCH-13), `orval.config.ts` with browser, server and zod outputs ([api/nextjs-openapi-clients.md](../08-crosscutting-concepts/api/nextjs-openapi-clients.md));
  - the platform: BFF route handlers, session store, `proxy.ts`, both instrumentation files, configuration, the three entry points;
  - `Dockerfile` and `.dockerignore` ([nextjs-delivery.md](../07-deployment-view/nextjs-delivery.md)), `scripts/check-bundle.mjs`, `test/` and `e2e/` with the stubbed test server ([testing/nextjs.md](../08-crosscutting-concepts/testing/nextjs.md));
  - `compose.yaml` and `.env.development` ([nextjs-local-development.md](../07-deployment-view/nextjs-local-development.md)), `configuration-keys.yaml` ([configuration/nextjs.md](../08-crosscutting-concepts/configuration/nextjs.md));
  - `.gitignore` and `.prettierignore` with `.next/`, `next-env.d.ts`, `*.tsbuildinfo`, `coverage/`, `playwright-report/`, `test-results/`, and the generated clients: `src/**/generated/` in `.gitignore`, so that the canary's `test/fixtures/**/generated/` file is committed.

## Enforcement

- **NEXT-ARCH-13: dependency-cruiser runs the TS-ARCH-12 template with the Next.js constants, changes and rules below, and its canary covers the client/server split.** Replaces the React constants and rule changes of REACT-ARCH-22 for Next.js; the React canary rules about routes files do not apply. The canary test (TS-ARCH-13) cruises `test/fixtures/arch-violation/` with an absolute `baseDir` and asserts: a type-only import of generated code into `domain` (`domain-is-pure`); `orders-panel.client.tsx` importing `orders.composition.server.ts` (`client-never-imports-server-only`); a route file with a deep import (`app-route-files-are-thin`, `generated-api-only-in-http-adapter`); a server component importing `@/platform/index.client` (`server-never-imports-client-entry`); and the **blind spot**: `orders-widget.tsx`, which has `'use client'` but no suffix and imports a server-only module, is **not** reported. That last test documents that dependency-cruiser cannot read directives; if it ever starts to fail, the tool has learned them and the suffix rules can be revisited. Only direct imports are checked: a client file reaching `server-only` through a `'use server'` module is legitimate in Next.js and cannot be told apart; Next's own `server-only` check fails the build for real violations.

```js
// Next.js constants at the top of .dependency-cruiser.cjs (replace the template's constants block)
const COMPOSITION_FILE = '\\.composition(\\.server)?\\.tsx?$';
const ROOT_HTTP_SETUP = '^src/app/providers\\.tsx?$';
const HTTP_CLIENT_MODULES = 'node_modules/(axios|ky|undici)/';
const TEST_FILE = '\\.(spec|test)\\.tsx?$';
const STORE_FILE = '\\.slice\\.tsx?$';
const PAGES_FILE = '^src/features/[^/]+/[^/]+\\.pages\\.tsx?$';
const SERVER_ACTIONS = '/adapter/in/next/[^/]+-actions\\.ts$';
const HTTP_MUTATOR = '^src/platform/adapter/out/http/(browser|server)-fetch\\.ts$'; // imported by Orval output only
const FEATURE_API_FILE = '^src/features/[^/]+/[^/]+\\.api\\.tsx$'; // the published feature API (REACT-ARCH-11)
const CLIENT_FILE = ['\\.client\\.tsx?$', '\\.composition\\.tsx$', FEATURE_API_FILE, '^src/app/(providers|app-shell|theme)\\.tsx?$'];
const SERVER_ONLY = ['\\.server\\.tsx?$', 'node_modules/server-only/', 'node_modules/next/dist/[^/]+/headers'];
const ROUTE_NAMES = '(page|layout|route|loading|error|not-found|template|default)\\.tsx?$';
const ROUTE_FILE = [`^src/app/${ROUTE_NAMES}`, `^src/app/.*/${ROUTE_NAMES}`]; // one pattern with (.+/)? is rejected as unsafe
```

Next.js changes to the template rules:

| Template rule | Next.js change |
|---|---|
| `stores-only-call-use-cases` | `from: { path: STORE_FILE }`; `STORE_FILE` replaces the `-store` pattern in `to.path` as well |
| `platform-only-via-index` | `from.path` adds `testing`; `to.pathNot` allows the three entries (`index.ts`, `index.client.ts`, `index.server.ts`, NEXT-ARCH-14) and `HTTP_MUTATOR` |
| `feature-routes-only-from-app`, `feature-routes-only-lazy` | removed: there are no routes files; replaced by `feature-pages-only-from-app` |
| `composition-root-not-imported` | `from.pathNot`: `PAGES_FILE`, `'^src/app/'`, the feature `index.ts`, `'^src/platform/index\\.server\\.ts$'` and `SERVER_ACTIONS` (the stated exception of NEXT-ARCH-04) |
| `http-clients-only-in-http-adapter` | `from.pathNot` adds `FEATURE_API_FILE` (the browser factory creates the adapters) |
| `options` | adds `enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'types', 'default'] }` and an `exclude` of `.next/` and `test/fixtures/` |

Next.js rules:

```js
{
  name: 'feature-pages-only-from-app', severity: 'error',
  comment: 'TS-ARCH-20 for Next.js: only the app route files import a feature pages file; the App Router splits per route',
  from: { pathNot: ['^src/app/', TEST_FILE] },
  to: { path: PAGES_FILE },
},
{
  name: 'app-route-files-are-thin', severity: 'error',
  comment: 'page/layout/route files render a feature page or bind a platform handler: no logic, no fetch, no generated client',
  from: { path: ROUTE_FILE },
  to: {
    pathNot: [PAGES_FILE, '^src/features/[^/]+/index\\.ts$', '^src/platform/index(\\.client|\\.server)?\\.ts$',
      '^src/app/[^/]+\\.tsx?$', 'node_modules/(next|react|next-intl)/', 'node_modules/@types/react/'],
  },
},
{
  name: 'app-uses-features-via-index-or-pages', severity: 'error',
  comment: 'TS-ARCH-10/20: the root files of src/app see a feature only through its public API and its pages file',
  from: { path: '^src/app/' },
  to: { path: '^src/features/[^/]+/', pathNot: ['^src/features/[^/]+/index\\.ts$', PAGES_FILE] },
},
{
  name: 'client-never-imports-server-only', severity: 'error',
  comment: "Client files never import server-only modules; dependency-cruiser cannot read 'use client', so file names decide",
  from: { path: CLIENT_FILE },
  to: { path: SERVER_ONLY },
},
{
  name: 'client-uses-client-platform-entry', severity: 'error',
  from: { path: CLIENT_FILE },
  to: { path: '^src/platform/index\\.server\\.ts$' },
},
{
  name: 'server-never-imports-client-entry', severity: 'error',
  comment: 'Redux and React context fail in the react-server build',
  from: { path: ['\\.server\\.tsx?$', SERVER_ACTIONS, PAGES_FILE] },
  to: { path: '^src/platform/index\\.client\\.ts$' },
},
{
  name: 'http-mutator-only-from-generated', severity: 'error',
  comment: 'TS-API-03: generated clients call the mutators; the platform composition configures the server mutator',
  from: { pathNot: ['/adapter/out/http/generated/', '^src/platform/'] },
  to: { path: HTTP_MUTATOR },
},
{
  name: 'feature-api-without-ui', severity: 'error',
  comment: 'REACT-ARCH-11: the published API imports adapters, use cases and the context only; never UI components or the slice',
  from: { path: FEATURE_API_FILE },
  to: { path: ['/adapter/in/ui/', STORE_FILE, COMPOSITION_FILE] },
},
```

The API file may import the feature's server actions (`adapter/in/next/*-actions.ts`), because the browser's cancel adapter receives the action from it (NEXT-ARCH-04); hence `/adapter/in/ui/` instead of the React rule's `/adapter/in/`. The rule passes on the real sources; it has no canary fixture in the Next.js template yet.

`app-uses-features-via-index-or-pages`, `http-mutator-only-from-generated` and `HTTP_MUTATOR` in `platform-only-via-index` are carried over from the React rules; in the template they pass on the real sources and fire on probes (a feature adapter importing the browser mutator, a route file importing a server composition; *verified*). All rules and the five canary assertions run there.

## Platform entries and client wiring

- **NEXT-ARCH-14: The platform has three entry points.** `src/platform/index.ts` is isomorphic (domain errors, `Caller`, the `PublicConfig` type, `HttpProblem`); `index.client.ts` holds what needs the browser React runtime (Redux store and hooks, `StoreProvider`, `PublicConfigProvider`, `usePublicConfig`, `ReportErrorProvider`, `useReportError`); `index.server.ts` starts with `import 'server-only'` and exports route handlers, `currentCaller()`, `publicRuntimeConfig()`, the logger and the security-header helpers. Server components, server actions and pages files never import `index.client.ts`: `react-redux` resolved under the `react-server` condition fails `next build` ("collect page data": `useDispatch.withTypes is not a function`). Client files never import `index.server.ts`. A feature's core still imports only `src/platform/domain/index.ts` (REACT-ARCH-04). Enforced by `platform-only-via-index`, `server-never-imports-client-entry` and `client-uses-client-platform-entry`.
- **NEXT-ARCH-15: The client composition `<feature>.composition.tsx` and the feature API file `<feature>.api.tsx` are `'use client'` files.** They are the Next.js form of REACT-ARCH-10/11: the API file holds the browser factory (`createOrdersUseCases({ reportError })`: browser HTTP adapter, server-action adapter, use cases) and `<OrdersApiProvider>`, which calls it in a lazy `useState` initializer with `useReportError()` from `@/platform/index.client` and provides the use-case object in the feature's one context; the composition injects the feature's slice (`rootReducer.inject(slice)` at module level) and renders the API provider around its children. The provider also runs in the server's SSR pass, once per render, so everything the factory creates is stateless and holds no user data. The composition does not export a route component; the pages file renders it around the server screen (NEXT-ARCH-02). The feature's `index.ts` re-exports `<Feature>ApiProvider` from the API file, which imports no UI and no slice (`feature-api-without-ui`, REACT-ARCH-11); a server component never renders another feature's provider through `index.ts` and calls another feature's server use cases only through that feature's published API (TS-ARCH-19).
- **NEXT-ARCH-16: Server-rendered data reaches TanStack Query as `initialData`.** The server component loads through the server use case and passes the domain data as a prop; the client component calls the feature's query hook with `initialData` (`useQuery({ ...ordersQuery(listOrders), initialData })`). After a command the client invalidates the keys and refetches through the browser use case and the `/api` proxy (REACT-ARCH-13). Query clients follow REACT-ARCH-13: one `QueryClient` per browser tab, created with a lazy `useState` in `providers.tsx` (one per request render during SSR). The Redux store follows the same pattern (`StoreProvider` with `useState(makeStore)`). A prefetch with `HydrationBoundary` is allowed when it calls the same server use case.
- **NEXT-ARCH-17: Lazy client UI inside a page uses `next/dynamic`.** Features are already split per route (NEXT-ARCH-01); within a page, a heavy client part that is not needed for the first paint (a dialog, an editor) loads with `dynamic(() => import('./cancel-order-form.client'), { ssr: false })`. Every lazily loaded chunk goes through the Trusted Types default policy of `instrumentation-client.ts` ([security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md)); E2E covers at least one lazy chunk.

## Skill overrides

| Skill or habit says | Our rule |
|---|---|
| `vercel-react-best-practices` `server-parallel-fetching`, `server-cache-react`, `server-auth-actions`, `async-api-routes`: server components, actions and route handlers call `db.*` or `fetch` | They are incoming adapters that call use cases; authenticate through the BFF session (NEXT-D4, NEXT-ARCH-02..05) |
| `vercel-react-best-practices` `server-cache-lru`: module-level LRU cache across requests | Cross-request caching is a decorator in the outgoing adapter with keys per user or tenant (TS-ARCH-15, API-N1-04); nothing user-specific at module level (NEXT-ARCH-03) |
| `vercel-react-best-practices` `server-after-nonblocking`: `after()` for logging and analytics | Logs go through the platform logger; `after()` work is never needed for correctness and must finish within the shutdown drain ([observability/nextjs.md](../08-crosscutting-concepts/observability/nextjs.md)) |
| `vercel-react-best-practices` `server-hoist-static-io` (Vercel Fluid Compute) | Self-hosted standalone server in our own image (NEXT-D2) |
| `vercel-react-best-practices` `bundle-dynamic-imports`: `next/dynamic` | Yes, for lazy client UI within a page; routes are split by the App Router (NEXT-ARCH-17) |
| `vercel-react-best-practices` `rendering-hydration-no-flicker`: inline `<script>` | Inline scripts carry the nonce; no tokens or personal data in browser storage (TS-SEC-01, [security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md)) |
| `tanstack-query-best-practices` `ssr-dehydration`, `ssr-hydration-boundary`: `prefetchQuery` with `fetch`, `getServerSideProps` | App Router only; server data comes from the server use case, passed as `initialData` or prefetched through the same use case (NEXT-ARCH-16) |
| Next.js docs: data fetching with `fetch` in server components, `next: { revalidate }`, `'use cache'` | Use cases via the server composition; dynamic by default, caching only for public pages without personal data (NEXT-ARCH-03, NEXT-ARCH-10) |
| Next.js docs: `<form action={serverAction}>` in a component, actions defined inline | Actions in `adapter/in/next/*-actions.ts`; components call use cases, the client adapter calls the action (NEXT-ARCH-04) |
| Components, hooks and route logic colocated in `app/` folders | `src/app` is routing and root composition only; code lives in features (NEXT-ARCH-01) |
| Route handlers as a REST API for business data | The backend owns the API; route handlers are BFF endpoints and the proxy (NEXT-ARCH-05) |
| Pages Router, `getServerSideProps`, `pages/api` | App Router only (NEXT-D1) |
| `middleware.ts` | `src/proxy.ts` with `export function proxy` (NEXT-ARCH-11) |
| `export const dynamic = 'force-static'` on a page with personal data | Dynamic rendering (NEXT-ARCH-10) |
| `next-auth` / Auth.js, `iron-session` | openid-client and the server-side session store (NEXT-D8) |
| `create-next-app` | Template of the `baseline-nextjs` skill (NEXT-ARCH-12) |
| Next.js skills `next-cache-components-*`, `next-partial-prefetching-*` | Not installed; Cache Components need an ADR (NEXT-ARCH-10) |

*Agent checklist in [checklists/nextjs.md](../checklists/nextjs.md) and sources in [sources.md](../sources.md), section "Next.js: Architecture and Project Structure".*
