# React: State Management with Redux Toolkit and TanStack Query

How view state and server state fit into the hexagonal React frontend. Short version: **the TanStack Query cache is the UI adapter's copy of what use cases returned, commands are TanStack mutations that call use cases, and a Redux Toolkit slice holds only view state that several components share.** None of them is a data layer, and none holds business rules. Applies to React SPA and to the client components of Next.js; Next.js server-side data loading: [05-building-block-view/nextjs.md](../../05-building-block-view/nextjs.md).

Implements: [TS-ARCH-03, TS-ARCH-08, TS-ARCH-15..18](../../05-building-block-view/typescript.md), [ARCH-ADP-02](../../05-building-block-view/adapters.md), [API-N1-01..04](../api/avoiding-n-plus-one.md), [RES-RTY-01..04](../resilience/resilience.md), and the defaults REACT-D3 and REACT-D4 ([04-solution-strategy/react.md](../../04-solution-strategy/react.md)). Wiring (the feature's context and selector hooks, its API and composition files) is REACT-ARCH-09..11, data loading in components REACT-ARCH-13 ([05-building-block-view/react.md](../../05-building-block-view/react.md)).

## Where state sits

```
component ──▶ useOrdersPage() (orders.queries.ts) ──────▶ LoadOrdersUseCase (ports/in, selector hook)
    │              TanStack Query cache: OrderPage (domain type)              │
    │                                                                        ▼
    ├──▶ useCancelOrderMutation().mutate(command) ──────▶ CancelOrderUseCase (ports/in, selector hook)
    │         mutation: isPending, error → toErrorKey; onSuccess invalidates  │
    ▼                                                                        ▼
 useAppSelector(selectOrdersView)                          services (application) ──▶ ports/out ◀── adapter/out/http
   orders.slice.ts: which order the dialog is for (shared view state)
```

| Kind of state | Lives in | Example |
|---|---|---|
| Server state (what a query use case returned) | TanStack Query cache, through a hook in `<feature>.queries.ts` | the current `OrderPage` |
| Status and error of a command | the TanStack mutation in `<feature>.queries.ts` | `isPending`, `error` mapped with `toErrorKey` |
| View state that several components of a screen share | Redux Toolkit slice in `<feature>.slice.ts` | which order the cancel dialog is for |
| State of one component only | `useState` | an open/closed toggle, the dialog's `Order` |
| State in the URL | router search params (REACT-ARCH-19) | `?page=2` |

## Rules

### Redux Toolkit: placement and dependencies

- **REACT-STATE-01: Slices live in `features/<feature>/adapter/in/ui/` as `<feature>.slice.ts`**, with their selector in the same file. Slices have no thunks that run commands (REACT-STATE-03). The `.slice.ts` suffix is how dependency-cruiser finds them (`STORE_FILE`, REACT-STATE-14).
- **REACT-STATE-02: There is one app store, and feature slices are injected lazily by their feature.** The root reducer, `RootState`, `AppDispatch` and the typed hooks live in `src/platform/adapter/in/ui/app-store.ts` (exported by `src/platform/index.ts`); the store instance is created once in the app root (`useState(createAppStore)` in `src/app/app.tsx`). The root reducer is `combineSlices().withLazyLoadedSlices<LazyLoadedSlices>()`. Each feature declares its slice by declaration merging through the platform's public entry, which re-exports `LazyLoadedSlices` as a type: `declare module '<relative path>/platform' { interface LazyLoadedSlices extends WithSlice<typeof ordersSlice> {} }` (checked with TypeScript 6.0: the augmentation merges through the `export type { LazyLoadedSlices }` re-export; without that re-export it does not, and `state.orders` fails to compile). No deep import of `app-store.ts`, so `platform-only-via-index` needs no exception. The composition injects the slice with `rootReducer.inject(ordersSlice)` at module level in `<feature>.composition.tsx`, which loads lazily with the route (REACT-ARCH-20), so slice and injection never reach the main bundle.
  *Why:* one store gives one dispatch and one devtools view; lazy injection keeps feature code out of the initial chunk. The reducer lives in `src/platform` because slices need `RootState` and features may not import `src/app`.
- **REACT-STATE-03: Commands run as TanStack `useMutation`s that call the use case; slices never call use cases.** The mutation hook lives in `<feature>.queries.ts` next to the query hooks (`useCancelOrderMutation()`); its `mutationFn` calls the contract from the feature's selector hook (`useCancelOrder()`, REACT-ARCH-09), `onSuccess` invalidates the feature's keys (REACT-STATE-11), and `onError` reports only unexpected errors (REACT-STATE-07). The component calls `mutate(command, { onSuccess })` for what is its own business after a success (announcement, closing the dialog), reads `isPending` for the busy state and maps `error` with the feature's `toErrorKey` (`errorKey={mutation.isError ? toErrorKey(mutation.error) : null}`). A new attempt starts with `mutation.reset()` when the dialog opens again. Thunks (`createAsyncThunk`) are not used for commands, and a slice file never imports adapters, services, outgoing ports, generated clients, the composition or API file, HTTP libraries or another slice (`stores-only-call-use-cases`, REACT-STATE-14). Use cases, commands and other non-serializable values never enter state or action payloads.
  *Why:* a command is server-state work; the mutation gives status, error, invalidation and cancellation of stale callbacks per component without copying them into a global store, and the use case stays the only way into the core (ARCH-ADP-02, TS-ARCH-03). Use cases live in React context per feature (REACT-ARCH-10), which a module-level store cannot see.

### Redux Toolkit: state and logic

- **REACT-STATE-04: Slice state is view state that several components share, never backend data:** which item a dialog is for, edit mode, selection, filters that are not in the URL. State of one component stays in `useState`; command status and errors stay in the mutation (REACT-STATE-03); a status that a distant component needs is read with `useMutationState` by mutation key before it is copied into a slice. Use-case results stay in the TanStack Query cache (REACT-STATE-11); never copy them into a slice. DTOs appear nowhere in the UI (TS-ARCH-05). Cross-feature data comes through the other feature's published API (TS-ARCH-19), never by selecting another feature's slice.
- **REACT-STATE-05: State is typed with an explicit `interface` with `readonly` fields and an `initialState` constant; components use only the typed hooks** `useAppDispatch = useDispatch.withTypes<AppDispatch>()` and `useAppSelector = useSelector.withTypes<RootState>()`. Each slice exports a selector that falls back to `initialState` (`state.orders ?? initialState`), because a lazily injected key stays optional in `RootState`. Reducers may "mutate" the draft (Immer); everything outside reducers treats state as immutable.
- **REACT-STATE-06: No business decisions in slices, mutations or selectors.** Selectors and components may call **pure domain functions** (`canBeCancelled(order)`); the rules themselves live in `domain` (TS-ARCH-02).
- **REACT-STATE-07: Errors are mapped to translation keys once per feature** (TS-ARCH-18, ARCH-ADP-05): `<feature>-error-keys.ts` in `adapter/in/ui` exports `toErrorKey(error)`, which turns the feature's domain errors into keys (`OrderAlreadyShipped` → `'alreadyShipped'`) and the platform's `TechnicalError` into the generic key (`'technical'`; every `TechnicalError` was reported where it was created: by the HTTP mutator or by the feature's HTTP adapter, TS-ARCH-18, REACT-OBS-04). The component maps the mutation's or query's error with it (`toErrorKey(mutation.error)`) and translates the key (`` t(`errors.${key}`) ``, REACT-I18N-04); no state holds translated text. The mapper imports only the feature's `domain` and `src/platform/domain`.
  Any other error is a bug: it also becomes the generic key **and is reported** through the platform's `ReportErrorUseCase` (REACT-OBS-01). For commands the mutation hook does this in `onError`, with `reportError` from `useReportError()` and the feature's `isUnexpected(error)` (neither a feature domain error nor a `TechnicalError`); the page test covers it. For queries the mechanism is to verify before first use: the screen reports a query's unexpected error in an effect keyed by the error.
- **REACT-STATE-08: Optimistic updates change the TanStack Query cache, not a slice, and roll back on failure:** `useMutation` whose `mutationFn` calls the use case, with `onMutate` (cancel running queries for the key, snapshot with `getQueryData`, write with `setQueryData`, return the snapshot), `onError` (restore the snapshot; report an unexpected error per REACT-STATE-07; the component maps `error` to its key) and `onSettled` (invalidate the feature's keys). Use cases stay unaware (TS-ARCH-03). Not covered by the validated project: verify before first use.

### TanStack Query

- **REACT-STATE-09: RTK Query and Orval's query clients are banned.** So are `useEffect` fetching and SWR. Server state goes through TanStack Query hooks whose `queryFn` calls a use case (REACT-D3, REACT-D4); Orval generates `client: 'fetch'` only (REACT-D8, [api/react-openapi-clients.md](../api/react-openapi-clients.md)). ESLint bans the RTK Query entry points (REACT-STATE-14).
  *Why:* both put HTTP into the UI adapter and skip the use case, the port and the mapping (TS-ARCH-04/05/08).
- **REACT-STATE-10: Each feature has one query-key factory, `<feature>Keys`, in `adapter/in/ui/<feature>.queries.ts`.** Keys start with the feature name and name the use case and its arguments, never URLs or endpoints: `ordersKeys = { all: ['orders'] as const, page: (page) => ['orders', 'page', { page, size }] as const }`. Every value the `queryFn` uses is in the key (`@tanstack/query/exhaustive-deps`). Queries are built with `queryOptions(...)` (`@tanstack/query/prefer-query-options`) inside a feature hook (`useOrdersPage(page)`); components call the hook, not `useQuery` with an inline function.
- **REACT-STATE-11: The cache holds the domain types use cases return; `staleTime` stays at the default; every command invalidates what it changed.**
  - `queryFn: ({ signal }) => loadOrders.load(query, signal)`: the use case returns frontend domain types (TS-ARCH-16), and the `AbortSignal` is passed through so a superseded or unmounted query cancels its request. `placeholderData: keepPreviousData` keeps the previous page visible while paging. No `select` that reshapes into DTO-like data. The cache is never persisted to web storage (`persistQueryClient` and similar; TS-SEC-01, DP rules) without an ADR.
  - `staleTime` SHOULD stay at TanStack's default `0` (refetch when a screen mounts again). A query may set a longer `staleTime` with the reason in a comment. Data shared across screens that rarely changes is cached in the outgoing adapter, not by raising `staleTime` (TS-ARCH-15, API-N1-04 S5).
  - After every successful command: `queryClient.invalidateQueries({ queryKey: <feature>Keys.all })` in the mutation hook's `onSuccess` (returned, so the mutation stays pending until the refetch is done), or in `onSettled` for an optimistic update (REACT-STATE-08). Invalidate the feature's root key unless a narrower key is clearly enough. Slices never get the `QueryClient`.
- **REACT-STATE-12: No per-row queries (N+1, API-N1-01).** A list never renders a component per row that calls its own query hook, and `useQueries` over a list of ids is the same N+1. The screen's use case returns what the list shows (S1), or the outgoing adapter batches or coalesces (S4/S5, API-N1-04). Every data-loading change states its N+1 check and recommended strategy in the PR, and the E2E request budget (TS-TEST-14) asserts the request count.

### Tests and enforcement

- **REACT-STATE-13: Slice tests are adapter tests** (TEST-ARCH-03): create the real store with `createAppStore()`, inject the slice, dispatch its actions and assert through the exported selector. Query and mutation hooks are tested through the screen's component test with an object of `mock<UseCase>()` contracts in the feature's context (London, TEST-TDD-07) and a fresh `QueryClient` with `retry: false`: the command by value, the reload after it, each mapped error key, the generic key, and that only an unexpected error is reported ([testing/react.md](../testing/react.md)).
- **REACT-STATE-14: The rules are enforced by tools:**
  - dependency-cruiser `stores-only-call-use-cases`: from `STORE_FILE = '\\.slice\\.tsx?$'` to `/adapter/out/`, `/application/`, `/ports/out/`, `/generated/`, another `STORE_FILE` or HTTP client modules is an error (REACT-STATE-03).
  - ESLint `@tanstack/eslint-plugin-query` `flat/recommended-strict` (REACT-STATE-10) ([development/react-tooling.md](../development/react-tooling.md)).
  - ESLint `no-restricted-imports` bans RTK Query (checked with ESLint 10.14): `{ patterns: [{ group: ['@reduxjs/toolkit/query', '@reduxjs/toolkit/query/*'], message: 'RTK Query is banned (REACT-STATE-09)' }] }`.

### Query client defaults and further rules

- **REACT-STATE-15: Query defaults are set once on the app's `QueryClient`**, created with `useState` in `src/app/app.tsx` (one per app in the browser):
  - `retry` only for transient technical failures: a function that returns `true` for a `TechnicalError` with failure `network` or `timeout` below a small attempt limit, never for business or server errors (RES-RTY-01/02). The HTTP mutator does not retry, so retries happen in one layer (RES-RTY-04). Mutations keep TanStack's default of no retry.
  - `retryDelay` with jitter (RES-RTY-03): TanStack's default (`min(1000 * 2^n, 30000)`) has none, so set for example `(n) => Math.min(1000 * 2 ** n, 8000) * (0.5 + Math.random() / 2)`. The template does this; `Math.random()` here carries a described `sonarjs/pseudo-random` disable (jitter is not security-relevant).
- **REACT-STATE-16: Route loaders do not prefetch with `ensureQueryData` by default.** Use cases are reachable only through the feature's React context, which a route loader cannot see, and the routes file may not import the feature statically (REACT-ARCH-20). `defaultPreload: 'intent'` already loads the route chunk early. Prefetching data needs a stated reason and a design that keeps REACT-ARCH-20.
- **REACT-STATE-17: Screens render loading, empty and error from the query result with the shared state components** (`isPending` → loading, `isError` → error with a retry that calls `refetch()`, empty data → empty state; UI-19, [react-mui.md](react-mui.md)). `throwOnError` and `useSuspenseQuery` are not used by default: they move error handling into boundaries, which then need the same mapping and reporting.
- **REACT-STATE-18: Query devtools are not part of production builds.** If a project adds `@tanstack/react-query-devtools`, it loads only in development (`import.meta.env.DEV` with a dynamic import), and the bundle check proves it is absent (TS-SEC-05 spirit). Not used in the validated project.

- **REACT-STATE-19: A failed refetch keeps the data on screen.** The full-screen `ErrorState` shows only when the query failed and has no data (`isError && data === undefined`, REACT-STATE-17); when data exists, a failed background refetch shows a non-blocking `Alert` with a retry above the data (`isRefetchError`). Every command invalidates its keys (REACT-STATE-11), so every booking refetches and one network blip would otherwise replace the page, unmount a running timer and discard open dialogs and drafts. A page test fails the second fetch and asserts that the data and the open dialog stay and the alert appears.
  *Why:* in TanStack Query v5 a failed refetch sets `status: 'error'` and keeps the cached data, so branching on `isError` alone destroys a working screen.
- **REACT-STATE-20 (implements TS-ARCH-21): Loads cancel through TanStack Query, and saves on the same item run one after another.** Every `queryFn` passes the `signal` TanStack Query hands it to the use case, and the key carries every input the user can change, so a superseded load is cancelled and its result never lands under the new key; no component starts a fetch of its own with an `AbortController` nobody aborts. Mutations that can fire in quick succession on one item (autosave of a cell) share a `scope: { id: <item key> }`, so TanStack Query runs them serially, and `onMutate`/`onSuccess` write the cache with an updater on the current data (`setQueryData(key, (old) => …)`), never with a value read before the mutation started. A slice reducer applies results the same way, from its current state. Test: a page test where an older response resolves last, and one with two overlapping saves on the same cell.
  *Why:* the query cache and mutation scopes already do what TS-ARCH-21 asks, but only if the signal is passed on and the writes use the current data.

## Example

```ts
// features/orders/adapter/in/ui/orders.slice.ts (excerpt): shared view state only
export interface OrdersViewState {
  readonly cancelOrderId: string | null; // set by the table's button, read by the page and the dialog
}

export const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    cancelRequested(state, action: PayloadAction<string>) {
      state.cancelOrderId = action.payload;
    },
    cancelClosed(state) {
      state.cancelOrderId = null;
    },
  },
});

declare module '../../../../../platform' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- RTK lazy-slice typing by declaration merging
  interface LazyLoadedSlices extends WithSlice<typeof ordersSlice> {}
}

export function selectOrdersView(state: RootState): OrdersViewState {
  return state.orders ?? initialState;
}
```

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
```

```ts
// features/orders/adapter/in/ui/orders.queries.ts: the command
export function useCancelOrderMutation(): UseMutationResult<Order, Error, CancelOrderCommand> {
  const cancelOrder = useCancelOrder();
  const queryClient = useQueryClient();
  const reportError = useReportError();
  return useMutation({
    mutationFn: (command: CancelOrderCommand) => cancelOrder.cancel(command),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ordersKeys.all }),
    onError: (error) => {
      if (isUnexpected(error)) reportError.report(error); // REACT-STATE-07
    },
  });
}
```

```tsx
// in the page component
const cancel = useCancelOrderMutation();

const submitCancel = (command: CancelOrderCommand) => {
  cancel.mutate(command, {
    onSuccess: (cancelled) => {
      announcer.announce(t('cancel.done', { number: cancelled.number }));
      dispatch(cancelClosed());
    },
  });
};

<CancelOrderDialog
  pending={cancel.isPending}
  errorKey={cancel.isError ? toErrorKey(cancel.error) : null}
  onSubmit={submitCancel}
  onDismiss={() => dispatch(cancelClosed())}
/>
```

The two `no-empty-object-type` disables (the `LazyLoadedSlices` interface and each `WithSlice` augmentation) carry a description, as TS-TOOL rules require.

## Skill overrides

| Skill or habit | Says | Our rule |
|---|---|---|
| `tanstack-query-best-practices` | `queryFn` / `mutationFn` call `fetch`, axios or API functions directly | `queryFn` and `mutationFn` call a use-case contract only; never HTTP, generated clients or outgoing ports (REACT-STATE-09/11, TS-ARCH-04/08) |
| `tanstack-query-best-practices` (`qk-factory-pattern`) | Key factories keyed by endpoint or URL | Keys name the feature, the use case and its arguments (REACT-STATE-10) |
| `tanstack-query-best-practices` (`err-retry-config`) | `retry: 3` default; retry decisions on HTTP status | Retry only transient `TechnicalError`s, with jitter, in one layer; the UI never sees status codes (REACT-STATE-15, TS-ARCH-18, RES-RTY-01..04) |
| `tanstack-query-best-practices` (`cache-stale-time`, `cache-defaults`) | Raise `staleTime` per data volatility | Default `0`; longer only with a stated reason; shared caching in the outgoing adapter (REACT-STATE-11, TS-ARCH-15) |
| `tanstack-query-best-practices` (`persist-queries`, offline rules) | Persist the cache to localStorage or IndexedDB | Not without an ADR, never for personal data or tokens (REACT-STATE-11, TS-SEC-01) |
| `tanstack-query-best-practices` (`mut-optimistic-updates`, `mut-rollback-context`) | Optimistic updates in `onMutate` with rollback | Agreed; `mutationFn` calls the use case, errors map to keys (REACT-STATE-08, REACT-STATE-07) |
| `tanstack-query-best-practices` (`mut-mutation-state`) | `useMutationState` for cross-component tracking | Agreed: a distant component reads the command's status by mutation key; slices hold only shared view state (REACT-STATE-03/04) |
| `tanstack-query-best-practices` (`pf-route-prefetch`, `pf-ensure-query-data`) | Prefetch in route loaders | Not by default (REACT-STATE-16) |
| `tanstack-query-best-practices` (`err-error-boundaries`) | `throwOnError` with `useQueryErrorResetBoundary` | Explicit loading, empty and error states in the screen (REACT-STATE-17) |
| `tanstack-query-best-practices` (`ssr-*`) | Pages Router `getServerSideProps`, server prefetch calling APIs | SPA: not applicable. Next.js: [05-building-block-view/nextjs.md](../../05-building-block-view/nextjs.md) |
| `tanstack-query-best-practices` | Devtools in the app | Development only, absent from production builds (REACT-STATE-18) |
| Generic habit | Duplicate query results into Redux | Server data stays in the query cache (REACT-STATE-04) |
| Generic habit, RTK docs | RTK Query (`createApi`) for server data | Banned (REACT-STATE-09) |
| RTK docs, generic habit | Commands as thunks that call `fetch`, API services or use cases from `extra`; command status in the slice | Commands are mutations calling use cases from the selector hook; status and error stay in the mutation (REACT-STATE-03) |
| Generic habit | `useEffect(() => { fetch(...).then(setState) }, [])` | TanStack Query hook calling a use case (REACT-STATE-09, REACT-ARCH-06/13) |
| `vercel-react-best-practices` (`client-swr-dedup`) | SWR or `fetch('/api/...')` in components for dedup | TanStack Query calling use cases; dedup and coalescing in the outgoing adapter (REACT-STATE-09, TS-ARCH-15) |

*Agent checklist in [checklists/react.md](../../checklists/react.md) and sources in [sources.md](../../sources.md), section "React: State Management with Redux Toolkit and TanStack Query".*
