# React: State Management with Redux Toolkit and TanStack Query

How view state and server state fit into the hexagonal React frontend. Short version: **a Redux Toolkit slice is the view state of the incoming UI adapter, and the TanStack Query cache is the UI adapter's copy of what use cases returned.** Neither is a data layer, and neither holds business rules. Applies to React SPA and to the client components of Next.js; Next.js server-side data loading: [05-building-block-view/nextjs.md](../../05-building-block-view/nextjs.md).

Implements: [TS-ARCH-03, TS-ARCH-08, TS-ARCH-15..18](../../05-building-block-view/typescript.md), [ARCH-ADP-02](../../05-building-block-view/adapters.md), [API-N1-01..04](../api/avoiding-n-plus-one.md), [RES-RTY-01..04](../resilience/resilience.md), and the defaults REACT-D3 and REACT-D4 ([04-solution-strategy/react.md](../../04-solution-strategy/react.md)). Wiring (contexts, composition files, `use<UseCase>()` hooks) is REACT-ARCH-09/10, data loading in components REACT-ARCH-13 ([05-building-block-view/react.md](../../05-building-block-view/react.md)).

## Where state sits

```
component ──▶ useOrdersPage() (orders.queries.ts) ──▶ LoadOrdersUseCase (ports/in, context hook)
    │              TanStack Query cache: OrderPage (domain type)            │
    │                                                                      ▼
    ├──▶ dispatch(cancelOrder({ useCase, command })) ──▶ CancelOrderUseCase (ports/in)
    │         orders.slice.ts: dialog, command status, error key            │
    ▼                                                                      ▼
 useAppSelector(selectOrdersView)                        services (application) ──▶ ports/out ◀── adapter/out/http
```

| Kind of state | Lives in | Example |
|---|---|---|
| Server state (what a query use case returned) | TanStack Query cache, through a hook in `<feature>.queries.ts` | the current `OrderPage` |
| View state shared by the screen's components, command status | Redux Toolkit slice in `<feature>.slice.ts` | which order the cancel dialog is for, `cancelStatus`, `cancelError` |
| State of one component only | `useState` | an open/closed toggle, the dialog's `Order` |
| State in the URL | router search params (REACT-ARCH-19) | `?page=2` |

## Rules

### Redux Toolkit: placement and dependencies

- **REACT-STATE-01: Slices live in `features/<feature>/adapter/in/ui/` as `<feature>.slice.ts`**, with the feature's thunks and its selector in the same file. The `.slice.ts` suffix is how dependency-cruiser finds them (`STORE_FILE`, REACT-STATE-14).
- **REACT-STATE-02: There is one app store, and feature slices are injected lazily by their feature.** The root reducer, `RootState`, `AppDispatch` and the typed hooks live in `src/platform/adapter/in/ui/app-store.ts` (exported by `src/platform/index.ts`); the store instance is created once in the app root (`useState(createAppStore)` in `src/app/app.tsx`). The root reducer is `combineSlices().withLazyLoadedSlices<LazyLoadedSlices>()`. Each feature declares its slice with `interface LazyLoadedSlices extends WithSlice<typeof ordersSlice> {}` (declaration merging) and injects it with `rootReducer.inject(ordersSlice)` at module level in `<feature>.composition.tsx`, which loads lazily with the route (REACT-ARCH-20), so slice and injection never reach the main bundle.
  *Why:* one store gives one dispatch and one devtools view; lazy injection keeps feature code out of the initial chunk. The reducer lives in `src/platform` because slices need `RootState` and features may not import `src/app`.
- **REACT-STATE-03: Thunks call use-case contracts they receive as arguments, and nothing else.** The component gets the use case from its context hook (`useCancelOrderUseCase()`, REACT-ARCH-09) and dispatches `cancelOrder({ useCase, command })`. A slice file never imports adapters, services, outgoing ports, generated clients, the composition file, HTTP libraries or another slice (`stores-only-call-use-cases`, REACT-STATE-14); the thunk middleware's `extra` argument is not used for use cases. Use cases, commands and other non-serializable values travel only in the thunk argument, never in state or action payloads. Redux Toolkit 2.14's serializability check ignores `meta.arg` by default, so this passes with the check on; never switch the check off.
  *Why:* the slice is an incoming adapter and reaches the core only through incoming ports (ARCH-ADP-02, TS-ARCH-03). Use cases live in React context per feature (REACT-ARCH-10), which a module-level store cannot see.

### Redux Toolkit: state and logic

- **REACT-STATE-04: Slice state is UI state, never backend data:** dialog and edit mode, selection, filters that are not in the URL, command status (`'idle' | 'pending' | 'succeeded' | 'failed'`), mapped error keys. Use-case results stay in the TanStack Query cache (REACT-STATE-11); never copy them into a slice. DTOs appear nowhere in the UI (TS-ARCH-05). Cross-feature data comes through the other feature's published API (TS-ARCH-19), never by selecting another feature's slice.
- **REACT-STATE-05: State is typed with an explicit `interface` with `readonly` fields and an `initialState` constant; components use only the typed hooks** `useAppDispatch = useDispatch.withTypes<AppDispatch>()` and `useAppSelector = useSelector.withTypes<RootState>()`. Each slice exports a selector that falls back to `initialState` (`state.orders ?? initialState`), because a lazily injected key stays optional in `RootState`. Reducers may "mutate" the draft (Immer); everything outside reducers treats state as immutable.
- **REACT-STATE-06: No business decisions in slices, thunks or selectors.** Selectors and components may call **pure domain functions** (`canBeCancelled(order)`); the rules themselves live in `domain` (TS-ARCH-02).
- **REACT-STATE-07: Errors are mapped to translation keys once per feature** (TS-ARCH-18, ARCH-ADP-05): `<feature>-error-keys.ts` in `adapter/in/ui` exports `toErrorKey(error)`, which turns the feature's domain errors into keys (`OrderAlreadyShipped` → `'alreadyShipped'`) and the platform's `TechnicalError` into the generic key (`'technical'`; the HTTP mutator has already reported it). Thunks use it in `rejectWithValue(toErrorKey(error))`; the slice holds the key, never text; the component translates it (`` t(`errors.${key}`) ``, REACT-I18N-04). The mapper imports only the feature's `domain` and `src/platform/domain`.
  Any other error is a bug: it also becomes the generic key **and is reported** through the platform's `ReportErrorUseCase` (REACT-OBS-01). The validated project did not cover this path; the mechanism is to verify before first use: the thunk receives `reportError` (from `useReportError()`) in its argument like the use case (REACT-STATE-03), and a screen reports a query's unknown error in an effect keyed by the error.
- **REACT-STATE-08: Optimistic updates change the TanStack Query cache, not a slice, and roll back on failure:** `useMutation` whose `mutationFn` calls the use case, with `onMutate` (cancel running queries for the key, snapshot with `getQueryData`, write with `setQueryData`, return the snapshot), `onError` (restore the snapshot; map the error per REACT-STATE-07) and `onSettled` (invalidate the feature's keys). Use cases stay unaware (TS-ARCH-03). Not covered by the validated project: verify before first use.

### TanStack Query

- **REACT-STATE-09: RTK Query and Orval's query clients are banned.** So are `useEffect` fetching and SWR. Server state goes through TanStack Query hooks whose `queryFn` calls a use case (REACT-D3, REACT-D4); Orval generates `client: 'fetch'` only (REACT-D8, [api/react-openapi-clients.md](../api/react-openapi-clients.md)). ESLint bans the RTK Query entry points (REACT-STATE-14).
  *Why:* both put HTTP into the UI adapter and skip the use case, the port and the mapping (TS-ARCH-04/05/08).
- **REACT-STATE-10: Each feature has one query-key factory, `<feature>Keys`, in `adapter/in/ui/<feature>.queries.ts`.** Keys start with the feature name and name the use case and its arguments, never URLs or endpoints: `ordersKeys = { all: ['orders'] as const, page: (page) => ['orders', 'page', { page, size }] as const }`. Every value the `queryFn` uses is in the key (`@tanstack/query/exhaustive-deps`). Queries are built with `queryOptions(...)` (`@tanstack/query/prefer-query-options`) inside a feature hook (`useOrdersPage(page)`); components call the hook, not `useQuery` with an inline function.
- **REACT-STATE-11: The cache holds the domain types use cases return; `staleTime` stays at the default; every command invalidates what it changed.**
  - `queryFn: ({ signal }) => loadOrders.load(query, signal)`: the use case returns frontend domain types (TS-ARCH-16), and the `AbortSignal` is passed through so a superseded or unmounted query cancels its request. `placeholderData: keepPreviousData` keeps the previous page visible while paging. No `select` that reshapes into DTO-like data. The cache is never persisted to web storage (`persistQueryClient` and similar; TS-SEC-01, DP rules) without an ADR.
  - `staleTime` SHOULD stay at TanStack's default `0` (refetch when a screen mounts again). A query may set a longer `staleTime` with the reason in a comment. Data shared across screens that rarely changes is cached in the outgoing adapter, not by raising `staleTime` (TS-ARCH-15, API-N1-04 S5).
  - After every successful command: `queryClient.invalidateQueries({ queryKey: <feature>Keys.all })`, in the component after the fulfilled thunk (`cancelOrder.fulfilled.match(result)`) or in a mutation's `onSettled`. Invalidate the feature's root key unless a narrower key is clearly enough. Thunks never get the `QueryClient`.
- **REACT-STATE-12: No per-row queries (N+1, API-N1-01).** A list never renders a component per row that calls its own query hook, and `useQueries` over a list of ids is the same N+1. The screen's use case returns what the list shows (S1), or the outgoing adapter batches or coalesces (S4/S5, API-N1-04). Every data-loading change states its N+1 check and recommended strategy in the PR, and the E2E request budget (TS-TEST-14) asserts the request count.

### Tests and enforcement

- **REACT-STATE-13: Slice and thunk tests are adapter tests** (TEST-ARCH-03): create the real store with `createAppStore()`, inject the slice, pass `mock<UseCase>()` from `vitest-mock-extended` as the thunk's use case (London, TEST-TDD-07), dispatch, and assert through the exported selector. Cover success, each mapped error key and the generic key. One test asserts that a thunk with a use case in its argument logs no `console.error` (REACT-STATE-03). Query hooks are tested through the screen's component test with mocked use-case contracts in the feature contexts and a fresh `QueryClient` with `retry: false` ([testing/react.md](../testing/react.md)).
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

## Example

```ts
// features/orders/adapter/in/ui/orders.slice.ts (excerpt)
export interface OrdersViewState {
  readonly cancelOrderId: string | null;
  readonly cancelStatus: 'idle' | 'pending' | 'succeeded' | 'failed';
  readonly cancelError: OrdersErrorKey | null;
}

export const cancelOrder = createAsyncThunk<
  undefined,
  { readonly useCase: CancelOrderUseCase; readonly command: CancelOrderCommand },
  { rejectValue: OrdersErrorKey }
>('orders/cancelOrder', async ({ useCase, command }, { rejectWithValue, signal }) => {
  try {
    await useCase.cancel(command, signal);
    return undefined;
  } catch (error) {
    return rejectWithValue(toErrorKey(error));
  }
});

declare module '../../../../../platform/adapter/in/ui/app-store' {
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
  const loadOrders = useLoadOrdersUseCase();
  return useQuery(
    queryOptions({
      queryKey: ordersKeys.page(page),
      queryFn: ({ signal }) => loadOrders.load({ page, size: ORDERS_PAGE_SIZE }, signal),
      placeholderData: keepPreviousData,
    }),
  );
}
```

```tsx
// in the page component: command through the thunk, then invalidate
const result = await dispatch(cancelOrder({ useCase: cancelUseCase, command }));
if (cancelOrder.fulfilled.match(result)) {
  announcer.announce(t('cancel.done', { number }));
  await queryClient.invalidateQueries({ queryKey: ordersKeys.all });
}
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
| `tanstack-query-best-practices` (`mut-mutation-state`) | `useMutationState` for cross-component tracking | Command status shared across components lives in the slice (REACT-STATE-04) |
| `tanstack-query-best-practices` (`pf-route-prefetch`, `pf-ensure-query-data`) | Prefetch in route loaders | Not by default (REACT-STATE-16) |
| `tanstack-query-best-practices` (`err-error-boundaries`) | `throwOnError` with `useQueryErrorResetBoundary` | Explicit loading, empty and error states in the screen (REACT-STATE-17) |
| `tanstack-query-best-practices` (`ssr-*`) | Pages Router `getServerSideProps`, server prefetch calling APIs | SPA: not applicable. Next.js: [05-building-block-view/nextjs.md](../../05-building-block-view/nextjs.md) |
| `tanstack-query-best-practices` | Devtools in the app | Development only, absent from production builds (REACT-STATE-18) |
| Generic habit | Duplicate query results into Redux | Server data stays in the query cache (REACT-STATE-04) |
| Generic habit, RTK docs | RTK Query (`createApi`) for server data | Banned (REACT-STATE-09) |
| RTK docs, generic habit | Thunks call `fetch` or import API services; services in `extra` | Thunks get use-case contracts in their argument (REACT-STATE-03) |
| Generic habit | `useEffect(() => { fetch(...).then(setState) }, [])` | TanStack Query hook calling a use case (REACT-STATE-09, REACT-ARCH-06/13) |
| `vercel-react-best-practices` (`client-swr-dedup`) | SWR or `fetch('/api/...')` in components for dedup | TanStack Query calling use cases; dedup and coalescing in the outgoing adapter (REACT-STATE-09, TS-ARCH-15) |

## Agent checklist

- [ ] Slice in `adapter/in/ui/<feature>.slice.ts`, injected in the composition, typed `interface`, selector with `?? initialState` (REACT-STATE-01/02/05)?
- [ ] Thunks get use-case contracts as arguments; no adapters, services, generated code, other slices; nothing non-serializable in state or payloads (REACT-STATE-03)?
- [ ] Slice holds view state and error keys only; server data in the query cache (REACT-STATE-04)?
- [ ] Errors mapped once per feature; unknown errors reported (REACT-STATE-07)?
- [ ] Query hook in `<feature>.queries.ts`, keys from `<feature>Keys`, `queryOptions`, `signal` passed to the use case (REACT-STATE-10/11)?
- [ ] Every command invalidates the affected keys; `staleTime` default unless reasoned (REACT-STATE-11)?
- [ ] No per-row queries, no `useQueries` over ids; N+1 check stated and request budget asserted (REACT-STATE-12)?
- [ ] No RTK Query, no Orval query client, no `useEffect` fetch (REACT-STATE-09)?
- [ ] Retry only transient technical errors, with jitter (REACT-STATE-15)?
- [ ] Slice tests with the real store and mocked use cases, incl. error keys and the serializability check (REACT-STATE-13)?

## Sources

Redux Toolkit 2.14 (redux-toolkit.js.org: `combineSlices`, `withLazyLoadedSlices`, `inject`, `createAsyncThunk`, serializability middleware), React Redux 9.3 (`useDispatch.withTypes`, `useSelector.withTypes`), TanStack Query 5.107 (tanstack.com/query: query keys, `queryOptions`, query cancellation, `invalidateQueries`, optimistic updates, retry and `retryDelay`; default retry delay checked in `@tanstack/query-core` source), `@tanstack/eslint-plugin-query` 5.107, ESLint `no-restricted-imports`. Validated in the React SPA reference build (2026-11-20). Skill: `tanstack-query-best-practices` (DeckardGer/tanstack-agent-skills, MIT).
