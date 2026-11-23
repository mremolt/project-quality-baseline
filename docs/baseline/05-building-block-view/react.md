# React: Architecture and Project Structure

How the hexagonal frontend ([05-building-block-view/typescript.md](typescript.md), TS-ARCH-*) is built with React 19, the React Compiler, TanStack Query, Redux Toolkit and MUI. Rules marked **(React SPA)** apply to the Vite + TanStack Router application; Next.js replaces them with its own rules and keeps every other rule here. Defaults: [04-solution-strategy/react.md](../04-solution-strategy/react.md). The adopted skills (`vercel-react-best-practices`, `tanstack-query-best-practices`) are the reference for React and TanStack Query APIs; this doc wins where they disagree (see the override table at the end).

## Project layout

```
index.html                  ← #root, the static start-up error message (two languages), the entry script
vite.config.ts  vitest.config.ts  orval.config.ts  eslint.config.ts  playwright.config.ts  .dependency-cruiser.cjs
scripts/check-bundle.ts     ← bundle gate in `verify` (budgets, lazy features stay lazy, no source-map links)
src/
  main.tsx                  ← bootstrap: strict-csp first, /config.json, createPlatform(), <html lang>, render (REACT-ARCH-23)
  strict-csp.ts             ← z.config({ jitless: true }); imported first (TS-SEC-09)
  app/                      ← root composition (React SPA)
    app.tsx                 ← providers: Emotion cache, theme, intl, platform, root error boundary, store, QueryClient, router
    router.tsx              ← route tree: createRootRoute/createRoute; spreads the features' route options (REACT-ARCH-20)
    shell.tsx               ← skip link, banner, navigation, <main> with <Outlet/>, route-change handler (REACT-ARCH-24)
    pages.tsx               ← app-level pages (home, not found)
    emotion-cache.ts        ← Emotion cache carrying the CSP nonce
  i18n/                     ← en.json (source catalog), de.json, messages.ts (locales, typed keys)
  platform/                 ← app-wide, cross-cutting; same rings and rules as a feature (REACT-ARCH-04)
    domain/index.ts         ← framework-free entry: TechnicalError, the RuntimeConfig type, shared value objects
    ports/in/ ports/out/ application/   ← report-error use case; error-reporting and runtime-config ports
    adapter/in/ui/          ← app-store.ts (combineSlices), root-error-boundary.tsx, route-error.tsx,
                              route-change-handler.tsx, global-error-listeners.ts, error-message.tsx
    adapter/out/http/       ← custom-fetch.ts (Orval mutator), xsrf.ts, http-problem.ts,
                              http-runtime-config.ts, http-error-reporting.ts
    platform.tokens.ts      ← contexts + useRuntimeConfig(), useReportError()
    platform.composition.tsx ← createPlatform(): reporting, global error listeners, configureHttp(); <PlatformProvider>
    index.ts                ← public API of the platform for adapters, composition and UI
  features/
    orders/
      domain/               ← order.ts, order-errors.ts
      application/          ← load-orders.service.ts, cancel-order.service.ts
      ports/in/             ← load-orders.use-case.ts, cancel-order.use-case.ts (command + zod schema)
      ports/out/            ← load-orders.port.ts, cancel-order.port.ts
      adapter/in/ui/        ← orders-page.tsx, cancel-order-dialog.tsx, orders.slice.ts, orders.queries.ts (queries and
                              mutations), orders-error-keys.ts
      adapter/out/http/     ← http-orders.ts, orders-mapper.ts, generated/ (Orval, gitignored)
      orders.tokens.ts      ← OrdersUseCases type, the feature's one context, selector hooks; imports only ports and react
      orders.api.tsx        ← published API: createOrdersUseCases(), <OrdersApiProvider>; adapters, use cases, context only
      orders.composition.tsx ← route chunk entry: slice injection, the route component (page inside the API provider)
      orders.routes.ts      ← route options (path, search schema, title key, lazy component); imported only by src/app
      index.ts              ← public API: published contracts, their selector hooks, <OrdersApiProvider> (TS-ARCH-19); no routes
  shared/ui/                ← theme.ts, a11y/announcer.ts, format/, states/ (loading, empty, error)
test/                       ← render-with-providers.tsx, setup-dom.ts, axe.ts, architecture.spec.ts, fixtures/arch-violation/
e2e/                        ← fixtures.ts, serve-dist.ts (CSP server for the built app), *.spec.ts
```

## Rules

### Structure and naming

- **REACT-ARCH-01: New code follows the layout above.** A feature has the rings of TS-ARCH-01..08 and the five root files `<feature>.tokens.ts`, `<feature>.api.tsx`, `<feature>.composition.tsx`, `<feature>.routes.ts` and `index.ts`.
- **REACT-ARCH-02: File names are kebab-case; components are PascalCase functions; `.tsx` only for files that contain JSX.** Roles are dot-suffixes: `.use-case.ts` (incoming port), `.port.ts` (outgoing port), `.service.ts` (use-case implementation), `.slice.ts` (Redux Toolkit view state), `.queries.ts` (TanStack Query keys, query and mutation hooks), `.tokens.ts`, `.api.tsx` (published feature API), `.composition.tsx`, `.routes.ts`, `.spec.ts(x)`. Components and hooks: `orders-page.tsx` exports `OrdersPage`; hooks start with `use`. The routes file holds no JSX and is `.ts`.
- **REACT-ARCH-03: Core files are named by business term** (`order.ts`, `order-errors.ts`, `cancel-order.use-case.ts`). Adapters are named technology + subject: `http-orders.ts` / `HttpOrders`. No `.model.ts`, `types.ts` or `utils.ts` collections.
- **REACT-ARCH-04: `src/platform` is treated like a feature**: same rings, same dependency-cruiser rules (TS-ARCH-12), reachable only through `src/platform/index.ts`, never imports `features/`. A feature's `domain`, `ports` and `application` import only `src/platform/domain/index.ts`. The one exception is the Orval mutator `src/platform/adapter/out/http/custom-fetch.ts`, which generated code imports directly (REACT-ARCH-22, [api/react-openapi-clients.md](../08-crosscutting-concepts/api/react-openapi-clients.md)).

### Components and hooks

- **REACT-ARCH-05: Function components only; the React Compiler is on, so no manual memoization.** Hooks follow the rules of hooks (lint: `react-hooks/rules-of-hooks`, `exhaustive-deps` and the compiler rules of `recommended-latest`). `useMemo`, `useCallback` and `memo()` are written only for a measured problem, with a comment naming the measurement; the compiler memoizes the rest. The only class component is an error boundary (REACT-ARCH-15); `@eslint-react/no-class-component` stays on and accepts classes that define `getDerivedStateFromError` or `componentDidCatch`. React 19 APIs: `<Context value>` as provider, `use(Context)` to read it.
  *Why:* compiled components re-render as little as hand-memoized ones, without dependency arrays that drift.
- **REACT-ARCH-06: `useEffect` only synchronizes with systems outside React**: `document.title`, router subscriptions, DOM focus, error reporting, browser listeners. Never for loading data (REACT-ARCH-13), for deriving state from props or state (compute it during render), or for reacting to a user event (handle it in the event handler). Lint `react-hooks/set-state-in-effect` fails a `setState` inside an effect body.
- **REACT-ARCH-07: Components render and forward intent** (TS-ARCH-02). Business decisions come from `domain` functions (`canBeCancelled(order)`), view state from the slice, server state from the feature's query hook. Presentational child components get values and callbacks as props.
- **REACT-ARCH-08: Use cases are plain classes or functions** that implement the `ports/in` contract and receive their outgoing ports through the constructor (TS-ARCH-01). They import nothing from React, the router, Redux Toolkit or TanStack Query.

### Wiring: tokens, composition, published API

The React form of TS-ARCH-09 and TS-ARCH-17: the token is one React context per feature, holding a typed object of the feature's use cases; the feature's API file creates that object and renders its provider.

- **REACT-ARCH-09: `<feature>.tokens.ts` holds the use-case object type, one context per feature and small selector hooks.** The type names each use case by its `ports/in` contract (`interface OrdersUseCases { loadOrders: LoadOrdersUseCase; cancelOrder: CancelOrderUseCase }`); the context holds that object (`createContext<OrdersUseCases | null>(null)`); `useOrdersUseCases()` reads it and throws outside the provider; one selector hook per use case returns its member (`useLoadOrders = () => useOrdersUseCases().loadOrders`). The file imports only the feature's `ports` and `react`. Components and query hooks call the selector hooks, never `use(Context)` directly; tests put an object of mocked contracts into the same context (`<OrdersContext value={{ loadOrders, cancelOrder }}>`, [testing/react.md](../08-crosscutting-concepts/testing/react.md)).
  *Why:* one provider per feature instead of a nested provider per use case; a new use case is one member, one hook and one line in the factory, and the test override stays one object.
- **REACT-ARCH-10: The adapters and use cases are created by a factory in `<feature>.api.tsx`, once per provider mount, from the platform values they need.** `createOrdersUseCases({ reportError })` creates the adapters and use cases and returns the use-case object (TS-ARCH-09). The provider calls it in a lazy `useState` initializer with the values it reads from the platform hooks: `const reportError = useReportError(); const [useCases] = useState(() => createOrdersUseCases({ reportError }));`. Configuration reaches use cases and adapters the same way: the provider reads `useRuntimeConfig()` and passes single values to the factory, which hands them to constructors (REACT-CFG-04). Instances are never created in the render body, and never at module level when they need platform values, which exist only in React context. Adapters and use cases are stateless, so a new set per mount costs nothing; a decorator whose cache must outlive one visit of the screen (REACT-API-11) keeps that cache in a module-level value of the API file, created on first use. `<feature>.composition.tsx` is the entry of the route chunk: it injects the slice at module level (REACT-STATE-02) and exports the route component (`OrdersScreen`), which renders the page inside the feature's provider.
- **REACT-ARCH-11: `<feature>.api.tsx` is the feature's published API and imports only adapters, use cases, the tokens file and the platform's public entry.** It exports the factory and `<Feature>ApiProvider`; `index.ts` re-exports the provider together with the published contracts and their selector hooks, never the context, the unpublished hooks or the use-case object type (TS-ARCH-19). The API file never imports the page or other UI, the slice or the composition file (dependency-cruiser `feature-api-without-ui`), so a consuming feature that wraps its screen in `<OrdersApiProvider>` in its own composition does not load the owning feature's screens or inject its slice. The provider holds the whole use-case object, but a consumer reaches only the published selector hooks. Because `index.ts` re-exports the API file, only lazily loaded feature code imports another feature's `index.ts` at runtime; `src/app` uses it for types only (`import type`; `src/shared` never imports a feature, TS-ARCH-11), and the bundle check fails when feature code reaches the initial chunk.

```tsx
// features/orders/orders.tokens.ts (imports only ports and react)
export interface OrdersUseCases {
  readonly loadOrders: LoadOrdersUseCase;
  readonly cancelOrder: CancelOrderUseCase;
}
export const OrdersContext = createContext<OrdersUseCases | null>(null);

export function useOrdersUseCases(): OrdersUseCases {
  const useCases = use(OrdersContext);
  if (useCases === null) throw new Error('useOrdersUseCases used outside OrdersApiProvider');
  return useCases;
}
export function useLoadOrders(): LoadOrdersUseCase {
  return useOrdersUseCases().loadOrders;
}
export function useCancelOrder(): CancelOrderUseCase {
  return useOrdersUseCases().cancelOrder;
}

// features/orders/orders.api.tsx (adapters, use cases, tokens, platform entry; no UI, no slice)
export function createOrdersUseCases({ reportError }: OrdersPlatform): OrdersUseCases {
  const http = new HttpOrders(reportError); // reports the technical errors it creates (REACT-OBS-04)
  return { loadOrders: new LoadOrdersService(http), cancelOrder: new CancelOrderService(http) };
}

export function OrdersApiProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const reportError = useReportError();
  const [useCases] = useState(() => createOrdersUseCases({ reportError }));
  return <OrdersContext value={useCases}>{children}</OrdersContext>;
}

// features/orders/orders.composition.tsx (entry of the route chunk)
rootReducer.inject(ordersSlice); // runs once, when the route chunk loads

export function OrdersScreen(): ReactNode {
  return <OrdersApiProvider><OrdersPage /></OrdersApiProvider>;
}

// features/orders/index.ts
export type { Order, OrderPage } from './domain/order';
export { OrdersApiProvider } from './orders.api';
export { useLoadOrders } from './orders.tokens';
export type { LoadOrdersQuery, LoadOrdersUseCase } from './ports/in/load-orders.use-case';
```

### HTTP and data loading

- **REACT-ARCH-12: The HTTP stack is configured once, in the platform.** `createPlatform()` in `platform.composition.tsx` calls `configureHttp()` (timeout, 401 handling, error reporting) before the first render; every generated client call passes the mutator in `src/platform/adapter/out/http` ([api/react-openapi-clients.md](../08-crosscutting-concepts/api/react-openapi-clients.md)). `fetch` is used only in `adapter/out/http` folders: ESLint `no-restricted-globals` forbids it everywhere else, because dependency-cruiser cannot see a global. Generated clients and `fetch` never appear in components, hooks, slices or use cases (TS-ARCH-04).
- **REACT-ARCH-13: Server state is loaded with TanStack Query in the UI adapter, and `queryFn` calls the use case** (REACT-D4, TS-ARCH-08). Keys, query hooks and mutation hooks live in `<feature>.queries.ts`; the hook gets the use case from the feature's selector hook (REACT-ARCH-09) and passes the query's `signal` (TS-API-06). Commands are TanStack `useMutation`s whose `mutationFn` calls the use case; `onSuccess` invalidates the feature's keys, and the component maps `mutation.error` with the feature's `toErrorKey` (REACT-STATE-03, REACT-STATE-07). Redux Toolkit holds only view state that several components share (REACT-STATE-04); a screen without such state has no slice (TS-ARCH-08). The `QueryClient` is created once in the root composition; its retry policy retries only transient technical failures (RES-RTY-01/02), because the mutator does not retry (RES-RTY-04). Keys, `staleTime`, invalidation and optimistic updates: [ui/react-state-management.md](../08-crosscutting-concepts/ui/react-state-management.md).

```ts
// features/orders/adapter/in/ui/orders.queries.ts
export const ordersKeys = {
  all: ['orders'] as const,
  page: (page: number) => ['orders', 'page', { page, size: ORDERS_PAGE_SIZE }] as const,
};

export function useOrdersPage(page: number): UseQueryResult<OrderPage> {
  const loadOrders = useLoadOrders();
  return useQuery(
    queryOptions({
      queryKey: ordersKeys.page(page),
      queryFn: ({ signal }) => loadOrders.load({ page, size: ORDERS_PAGE_SIZE }, signal),
      placeholderData: keepPreviousData,
    }),
  );
}

export function useCancelOrderMutation(): UseMutationResult<Order, Error, CancelOrderCommand> {
  const cancelOrder = useCancelOrder();
  const queryClient = useQueryClient();
  const reportError = useReportError();
  return useMutation({
    mutationFn: (command: CancelOrderCommand) => cancelOrder.cancel(command),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ordersKeys.all }),
    onError: (error) => {
      if (isUnexpected(error)) reportError.report(error); // a bug: neither a domain nor a technical error
    },
  });
}

// src/app/app.tsx: retry only what a second attempt can fix
function retryTransient(failureCount: number, error: Error): boolean {
  return failureCount < 2 && error instanceof TechnicalError && ['network', 'timeout'].includes(error.failure);
}
```

- **REACT-ARCH-25 (implements TS-ARCH-22): Time comes from the platform's `clock`, the business date from `businessDate()` in `src/platform/domain`.** `createPlatform()` creates `clock: { now: () => Date.now() }` (the only `Date.now()` outside tests, ESLint REACT-TOOL-15) and hands it to the feature factories and the hooks that tick; tests pass a fixed clock. `businessDate(instant)` and `businessMonth(instant)` format with `Intl.DateTimeFormat('en-CA', { timeZone })` in the product's zone, declared once in the platform.

### Forms

- **REACT-ARCH-14: Forms use React Hook Form with `standardSchemaResolver` and the command's zod schema from `ports/in`** (REACT-D6, TS-ARCH-06). Submitting builds the command through its validating factory (`CancelOrderCommand.of(values)`). MUI inputs are bound with `Controller`, taking `ref` out of `field` and passing it as `inputRef`: `render={({ field: { ref, ...field } }) => <TextField {...field} inputRef={ref} />}`. Spreading the whole `field` into `TextField` puts the ref on the root element, and React Hook Form then cannot move focus to the first invalid field after a failed submit (A11Y-22; asserted by REACT-TEST-10). Field errors are shown as translated text linked to the field. `standardSchemaResolver` is imported from `@hookform/resolvers/standard-schema`; it works with branded zod schemas.

```tsx
// ports/in/cancel-order.use-case.ts (framework-free): one schema for the command and the form
export const CancelOrderSchema = z
  .object({ orderId: z.string().min(1), reason: z.string().trim().min(3).max(200) })
  .brand<'CancelOrderCommand'>();
export type CancelOrderCommand = Readonly<z.output<typeof CancelOrderSchema>>;
export const CancelOrderCommand = {
  of(input: z.input<typeof CancelOrderSchema>): CancelOrderCommand {
    return Object.freeze(CancelOrderSchema.parse(input));
  },
};

// adapter/in/ui/cancel-order-dialog.tsx
const { control, handleSubmit } = useForm({
  resolver: standardSchemaResolver(CancelOrderSchema),
  defaultValues: { orderId: order.id, reason: '' },
});
const submit = handleSubmit((values) => {
  onSubmit(CancelOrderCommand.of(values));
});

<Controller
  name="reason"
  control={control}
  render={({ field: { ref, ...field }, fieldState }) => (
    <TextField
      {...field}
      inputRef={ref} // the input gets the ref: focus moves to the first invalid field on submit (A11Y-22)
      label={t('cancel.reason')}
      helperText={fieldState.error ? t('cancel.reasonInvalid') : t('cancel.reasonHelp')}
      error={fieldState.error !== undefined}
      required
    />
  )}
/>
```

### Errors

- **REACT-ARCH-15: Render errors are caught by two error boundaries, and both report.** A root boundary in the root composition (a class with `getDerivedStateFromError` and `componentDidCatch`, reading the report-error use case through `static contextType`) catches what happens outside the router; the root route's `errorComponent` catches route errors and offers `reset` as retry. Both show the platform's generic error message, never error details, and both call the report-error use case (OBS-14, [observability/react.md](../08-crosscutting-concepts/observability/react.md)). Domain errors from use cases are not render errors: the UI maps them to translation keys, once per feature (TS-ARCH-18).

```tsx
// platform/adapter/in/ui/root-error-boundary.tsx
export class RootErrorBoundary extends Component<Props, State> {
  static override readonly contextType = ReportErrorContext;
  declare context: ReportErrorUseCase | null;
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }
  override componentDidCatch(error: Error): void {
    this.context?.report(error);
  }
  override render(): ReactNode {
    return this.state.failed ? <ErrorMessage /> : this.props.children;
  }
}
```

### N+1 requests

- **REACT-ARCH-16: Every data-loading feature gets an N+1 check** (API-N1-01). Typical React traps: a row component with its own `useQuery` per item (N requests; TanStack Query deduplicates identical keys but never batches different ones), and dependent queries that wait for each other (a waterfall). Fix per-row loading with a view endpoint (API-N1 S1) or a batch endpoint plus request coalescing in the outgoing adapter (S2 + S4, TS-ARCH-15); fix a waterfall in the use case with `Promise.all` (S6) or with S1. Never batch in components or query hooks (API-N1-04). Recommend a strategy; the developer decides (API-N1-02).

## New app (React SPA)

- **REACT-ARCH-17: (React SPA) A new app starts from the template of the `baseline-react` skill, not from a scaffolder.** The template is the validated setup described in this section; `npm create vite` templates bring a different tsconfig, lint set and folder layout and are not used. Steps: copy the template into the component folder (`frontend/`, REPO-TOOL-03), rename the example feature, point `orval.config.ts` at the backend's spec (TS-API-01), run `npm install` once to create the lockfile, then `npm ci` and `npm run verify`, then sync the baseline into the repository. The template contains:
  - `package.json` with exact pins, `engines` (`node >=26.0.0 <27`, `npm >=11.10.0`), the TS-TOOL-10 scripts (`verify` = `generate:api`, `format:check`, `lint`, `check:arch`, `check:unused`, `test`, `build`, `check:bundle`), `.npmrc` (TS-TOOL-11), `.nvmrc` `26`;
  - `tsconfig.json`: the TS-TOOL-01 options plus `"jsx": "react-jsx"`, `"module": "preserve"`, `"moduleResolution": "bundler"`, `"types": ["vite/client", "node"]`, `"resolveJsonModule": true` (catalogs), `"allowImportingTsExtensions": true` with `"noEmit": true` (Vite 8 config import, see below); one tsconfig for `src`, `test`, `e2e`, `scripts` and the config files, so ESLint's `projectService` covers all of them;
  - `.gitignore` and `.prettierignore` with `src/**/generated/`, `dist/`, `coverage/`, `playwright-report/`, `test-results/`;
  - the config files, `scripts/check-bundle.ts`, `test/` helpers and the architecture canary (REACT-ARCH-22), and the `e2e/` fixtures with the CSP-serving test server ([testing/react.md](../08-crosscutting-concepts/testing/react.md)).
- **REACT-ARCH-18: (React SPA) `vite.config.ts` sets exactly these options:**
  - `plugins: [react(), babel({ presets: [reactCompilerPreset()] })]` with `import react, { reactCompilerPreset } from '@vitejs/plugin-react'` and `import babel from '@rolldown/plugin-babel'` (REACT-D1). The compiler's output is in every app chunk (`react.memo_cache_sentinel`). The experimental `react({ compiler: true })` variant is not used.
  - `html.cspNonce: 'CSP_NONCE_PLACEHOLDER'`: Vite emits `<meta property="csp-nonce">` and puts the nonce on the entry script and every `modulepreload` link; the BFF replaces the placeholder per response ([security/react.md](../08-crosscutting-concepts/security/react.md)).
  - `build.target: ['chrome119', 'edge119', 'firefox119', 'safari17']`, the TS-TOOL-02 browser set.
  - `build.sourcemap: 'hidden'`: maps for the error-reporting upload, no `sourceMappingURL` in the bundle (TS-SEC-05, [observability/react.md](../08-crosscutting-concepts/observability/react.md)).
  - `build.rolldownOptions.output.strictExecutionOrder: true`: keeps module order across chunks, so `src/strict-csp.ts` (`z.config({ jitless: true })`, imported first by `main.tsx`) runs before any zod schema in a shared chunk is created (TS-SEC-09). Without it Rolldown hoists zod into a shared chunk that runs first, and zod's JIT probe is reported as a CSP and Trusted Types violation. Cost in the validation project: +8.4 kB gzip initial.
  - `define` only for values identical in every environment: the commit (REL-VER-05). Never the release version, an environment name or a URL; those come from `/config.json` (CFG-02, CFG-11).
  - `server.proxy` for `/config.json` and `/api` to the locally running BFF.

  `vitest.config.ts` imports the Vite config with its extension (`import viteConfig from './vite.config.ts'`); Vite 8 warns that the extensionless form will stop working with its native config loader.
- **REACT-ARCH-19: (React SPA) Search params are validated with a zod schema in the route definition** (`validateSearch: OrdersSearch`; TanStack Router accepts a Standard Schema directly). Search params are untrusted input: a schema falls back to defaults (`.default(0).catch(0)`) instead of showing an error page for a hand-edited URL. Pages read them typed through `getRouteApi('/orders').useSearch()`. Path params are parsed into domain values with the domain's factory before use; a path-param schema in the route definition (`params.parse`) is to be verified before first use.
- **REACT-ARCH-20: (React SPA) Routes are code-based TanStack Router routes: definitions static, components lazy.** This is the React SPA form of TS-ARCH-20. The route tree must be known when the app starts (typed links and search params), so `src/app/router.tsx` imports each feature's routes file **statically**. The routes file therefore exports only route **options**: `path`, `validateSearch`, `staticData` (the route's title key, UI-16) and `component: lazyRouteComponent(() => import('./orders.composition'), 'OrdersScreen')`. Its only static imports are `@tanstack/react-router`, `zod` and `react`; the page, slice injection, adapters, use cases and composition load with the route chunk. The app calls `createRoute({ getParentRoute: () => rootRoute, ...ordersRouteOptions })`. A route factory (`createOrdersRoute(getParentRoute)`) type-checks, but its return type cannot be written down for `explicit-module-boundary-types`, so it is not used. `index.ts` still never exports routes. Enforced twice: dependency-cruiser `feature-routes-load-feature-lazily` and `app-uses-features-via-index-or-routes` (REACT-ARCH-22), and the bundle check, which fails when feature code (`/api/v1/`) is in an initial chunk. No file-based routing and no router bundler plugin (REACT-D2).

```ts
// features/orders/orders.routes.ts
const OrdersSearch = z.object({ page: z.int().nonnegative().default(0).catch(0) });

export const ordersRouteOptions = {
  path: 'orders',
  validateSearch: OrdersSearch,
  staticData: { titleKey: 'orders.page.title' },
  component: lazyRouteComponent(() => import('./orders.composition'), 'OrdersScreen'),
} as const;

// app/router.tsx
const rootRoute = createRootRoute({ component: Shell, errorComponent: RouteError, notFoundComponent: NotFoundPage,
  staticData: { titleKey: 'app.notFound.title' } });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage,
  staticData: { titleKey: 'app.home.title' } });
const ordersRoute = createRoute({ getParentRoute: () => rootRoute, ...ordersRouteOptions });

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, ordersRoute]),
  scrollRestoration: true,
  defaultPreload: 'intent',
});
declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
```

- **REACT-ARCH-21: (React SPA) A failed route-chunk load reloads the page once, through TanStack Router** (REL-FE-04). `lazyRouteComponent` already does this: on a module-not-found error (the Chrome, Firefox and Safari messages) it reloads once, guarded by the `sessionStorage` key `tanstack_router_reload:<error message>`. No own handler is written. Differences to a release-keyed guard: the key contains the chunk URL in Chrome and Firefox, so it is effectively per release; Safari's message has no URL, so there is at most one such reload per session in Safari. A second failure reaches the root route's `errorComponent`, which shows the generic error with a retry and reports (REACT-ARCH-15). The guarantee holds only for route components loaded with `lazyRouteComponent`; `.lazy()` route files and `React.lazy` are not covered, so they are not used for routes. It needs the BFF to answer a missing `/assets/*` file with `404`, never `index.html` (REL-FE-03). An E2E test serves a 404 for the first request of the chunk and asserts exactly two document loads and the rendered page.

## Enforcement

- **REACT-ARCH-22: (React SPA) dependency-cruiser runs the TS-ARCH-12 template with the React constants and additions below** (Next.js: NEXT-ARCH-13) (`npm run check:arch` = `depcruise src`). The canary test (TS-ARCH-13) runs dependency-cruiser's `cruise()` API on `test/fixtures/arch-violation/` and asserts three violations: a type-only import of generated code into `domain` (`domain-is-pure`), a routes file that imports the composition statically (`feature-routes-load-feature-lazily`) and a feature API file that imports the page (`feature-api-without-ui`); a fourth test asserts the real sources are clean. The canary passes an **absolute** `baseDir`: with a relative one, bare imports such as `react` stay unresolved and match allow-list rules by accident. The fixtures folder is excluded from the normal run and from lint. `tsPreCompilationDeps: true` reports `.tsx`, `import type` and `import()` edges correctly.

```js
// React constants at the top of .dependency-cruiser.cjs (replace the template's constants block)
const COMPOSITION_FILE = '\\.composition\\.tsx?$';
const ROOT_HTTP_SETUP = '^src/platform/platform\\.composition\\.tsx$'; // configureHttp() runs in the platform composition
const HTTP_CLIENT_MODULES = 'node_modules/(axios|ky)'; // fetch is a global: ESLint no-restricted-globals covers it
const STORE_FILE = '\\.slice\\.tsx?$'; // Redux Toolkit slices are the view-state stores
const ROUTES_FILE = '^src/features/[^/]+/[^/]+\\.routes\\.tsx?$';
const HTTP_MUTATOR = '^src/platform/adapter/out/http/custom-fetch\\.ts$'; // imported by Orval output only
const TEST_FILE = '\\.(spec|test)\\.tsx?$'; // colocated tests import vitest: excluded from the core allow-lists
const ROUTES_STATIC_ALLOWED = 'node_modules/(@tanstack/react-router|zod|react)/';
const FEATURE_API_FILE = '^src/features/[^/]+/[^/]+\\.api\\.tsx?$'; // the published feature API (REACT-ARCH-11)
```

React changes to the template rules:

| Template rule | React change |
|---|---|
| `stores-only-call-use-cases` | `from: { path: STORE_FILE }`; `STORE_FILE` replaces the `-store` pattern in `to.path` as well |
| `platform-only-via-index` | `HTTP_MUTATOR` added to `to.pathNot` (generated code imports the mutator with a deep relative path) |
| `feature-routes-only-from-app` | `to: { path: ROUTES_FILE }` (same pattern, named once) |
| `feature-routes-only-lazy` | removed: the app imports routes files statically (REACT-ARCH-20); replaced by the two rules below |
| `composition-root-not-imported` | `from.pathNot` allows `'^src/platform/index\\.ts$'`: the platform index exports `createPlatform`; a feature index re-exports `<feature>.api.tsx`, never the composition |
| `http-clients-only-in-http-adapter` | `FEATURE_API_FILE` added to `from.pathNot`: the feature API file creates the adapters like a composition file |
| `options` | adds `enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'types'] }` and `exclude: { path: '^test/fixtures/' }` |

React additions:

```js
{
  name: 'app-uses-features-via-index-or-routes', severity: 'error',
  comment: 'TS-ARCH-10/20: the app shell sees a feature only through its public API and its routes file',
  from: { path: '^src/app/' },
  to: { path: '^src/features/[^/]+/', pathNot: ['^src/features/[^/]+/index\\.ts$', ROUTES_FILE] },
},
{
  name: 'feature-routes-load-feature-lazily', severity: 'error',
  comment: 'TS-ARCH-20 (TanStack Router, code-based): the routes file imports only the router, zod and react statically; ' +
    'page, slice, adapters and composition only through import()',
  from: { path: ROUTES_FILE },
  to: { dependencyTypesNot: ['dynamic-import'], pathNot: ROUTES_STATIC_ALLOWED },
},
{
  name: 'http-mutator-only-from-generated', severity: 'error',
  comment: 'TS-API-03: generated clients call the mutator; everything else goes through ports',
  from: { pathNot: ['/adapter/out/http/generated/', '^src/platform/'] },
  to: { path: HTTP_MUTATOR },
},
{
  name: 'feature-api-without-ui', severity: 'error',
  comment: 'REACT-ARCH-11: the published API imports adapters, use cases and the context only; ' +
    'never the page, other UI or the slice, which would load for every consumer',
  from: { path: FEATURE_API_FILE },
  to: { path: ['/adapter/in/', STORE_FILE, COMPOSITION_FILE] },
},
```

With these constants, `http-clients-only-in-http-adapter` lets only `adapter/out/http`, `src/platform/adapter/`, composition files, feature API files and the platform composition import `axios` or `ky` (neither is used); `fetch` is covered by ESLint (REACT-ARCH-12).

## Bootstrap and shell (React SPA)

- **REACT-ARCH-23: (React SPA) `main.tsx` bootstraps in a fixed order:** `import './strict-csp'` as the first import; load and validate `/config.json` ([configuration/react.md](../08-crosscutting-concepts/configuration/react.md)); `createPlatform(config, currentRoute)` (reporting, global error listeners, `configureHttp()`); pick the locale and set `document.documentElement.lang` (A11Y-32); `createRoot(...).render(<StrictMode><App … /></StrictMode>)`. If anything fails before the first render, it un-hides the static, bilingual `#startup-error` message of `index.html` (no catalog and no reporting exist yet). App-wide initialization happens here or in `createPlatform()`, never in a component effect.
- **REACT-ARCH-24: (React SPA) The root composition and the shell are in `src/app`.** `app.tsx` creates the Emotion cache, the app store and the `QueryClient` once with lazy `useState` initializers and nests the providers in the order their consumers need them: Emotion `CacheProvider`, `ThemeProvider` + `CssBaseline`, `IntlProvider`, `PlatformProvider`, `RootErrorBoundary`, the Redux `Provider`, `QueryClientProvider`, `RouterProvider`. `shell.tsx` is the root route's component: skip link, `header` banner, labelled `nav` with router links (`createLink(MuiLink)`, which sets `aria-current="page"`), `main` with the `Outlet` (A11Y-23), and the platform's route-change handler for title and focus (UI-16, A11Y-21: no extra announcement).

## Skill overrides (`vercel-react-best-practices`, `tanstack-query-best-practices`, generic habits)

| Skill or habit says | Our rule |
|---|---|
| `rerender-memo`, `rerender-simple-expression-in-memo`, `rendering-hoist-jsx`: `memo()`, `useMemo`, hoisting by hand | The React Compiler is on; manual memoization only for a measured problem (REACT-ARCH-05) |
| `client-swr-dedup`: SWR or `fetch('/api/…')` in components | Components never fetch; TanStack Query calls use cases; dedupe and caching of backend data are adapter decorators (REACT-ARCH-13, TS-ARCH-15) |
| `queryFn` / `mutationFn` call `fetch`, axios or generated API functions | `queryFn` and `mutationFn` call a use-case contract from the feature's selector hook (REACT-ARCH-13, REACT-STATE-03) |
| Load data in `useEffect` | TanStack Query (REACT-ARCH-13); effects only sync with outside systems (REACT-ARCH-06) |
| `advanced-init-once`: module-level app initialization anywhere | App-wide init in `main.tsx` / `createPlatform()`; feature use cases from the factory in `<feature>.api.tsx`, once per provider mount (REACT-ARCH-10, REACT-ARCH-23) |
| `bundle-barrel-imports`: avoid barrel files | Applies to third-party packages (`@mui/material/Button`); our feature and platform `index.ts` stay mandatory (TS-ARCH-10/19, REACT-ARCH-11) |
| `bundle-dynamic-imports`: `next/dynamic` | React SPA: route components through `lazyRouteComponent` (REACT-ARCH-20) |
| `async-dependencies`: add `better-all` | `Promise.all`; dependencies are added deliberately (TS-TOOL-13) |
| File-based routing, `createFileRoute`, the TanStack Router bundler plugin (also the default of the official TanStack Router skills) | Code-based routes, static options, lazy components (REACT-D2, REACT-ARCH-20) |
| `React.lazy` or `.lazy()` route files for code splitting | `lazyRouteComponent`, which carries the one-time reload (REACT-ARCH-21) |
| `npm create vite` to start an app | Template of the `baseline-react` skill (REACT-ARCH-17) |
| Folders `components/`, `hooks/`, `services/`, `store/` at the top level | Ring layout per feature, `src/platform`, `src/shared/ui` (REACT-ARCH-01) |
| Tailwind, shadcn/ui | MUI with the app theme (REACT-D5) |
| RTK Query or Orval `react-query` / `swr` clients | Not used (REACT-D3, REACT-D8) |
| Run `vite build` or `tsc` to check generated code | Run `npm run verify` (format, lint, architecture, tests, build, bundle check) |

*Agent checklist in [checklists/react.md](../checklists/react.md) and sources in [sources.md](../sources.md), section "React: Architecture and Project Structure".*
