# Angular State Management: NgRx Signal Store

How `@ngrx/signals` Signal Stores fit into the hexagonal frontend. Short version: **a Signal Store is the view state of the incoming UI adapter.** It holds what the screen shows and forwards user intent to use cases. It is not a data layer and not a place for business rules.

Implements: [TS-ARCH-08](../../05-building-block-view/typescript.md), [ARCH-ADP-02](../../05-building-block-view/adapters.md), [ARCH-UC-02](../../05-building-block-view/use-cases.md). The `ngrx-signals` skill (our adaptation) contains the API know-how and follows these rules.

## Where the store sits

```
component ──▶ OrdersStore (adapter/in/ui) ──▶ LoadOrderHistoryUseCase (ports/in, token)
   ▲               │  state: filter, selection, use-case results          │
   └── signals ────┘                                                       ▼
                                             LoadOrderHistoryService (application)
                                                           │
                                                           ▼
                                             LoadOrdersPort (ports/out) ◀── HttpOrders (adapter/out/http)
```

The skill's original advice ("the store holds state and orchestration, a service does the I/O") becomes **"the store holds view state, the use case does the work"**.

## Rules

### Placement and dependencies

- **NG-STATE-01: Signal Stores live in `features/<feature>/adapter/in/ui/`**, named after the screen or feature with the `-store` intent suffix (`orders-store.ts`, `OrdersStore`).
- **NG-STATE-02: Store methods call use-case contracts only**, injected through the tokens from `<feature>.tokens.ts` (TS-ARCH-08/17). A store MUST NOT inject `HttpClient`, generated API services, outgoing ports, adapters, or another store. dependency-cruiser checks it, type-only imports included (`stores-only-call-use-cases` in [angular.md](../../05-building-block-view/angular.md#enforcement)).
  *Why:* the store is an incoming adapter; incoming adapters reach the core only through incoming ports (ARCH-ADP-02).
- **NG-STATE-03: Cross-feature data comes through the other feature's published API** (`index.ts` and `provide<Feature>Api()`, TS-ARCH-10/19), never by injecting its store.

### State

- **NG-STATE-04: State contains UI state** (filters, selection, dialog/edit mode, request status) **and use-case results or domain values** (frontend use cases may return domain types, TS-ARCH-16). Never backend DTOs. Values are immutable (`readonly`).
- **NG-STATE-05: State is typed with an explicit `interface`** (`withState<OrdersState>(initialState)`), and stays protected (default). Mutations happen only through store methods. Tests seed state with `unprotected()` from `@ngrx/signals/testing`.
- **NG-STATE-06: Collections with stable IDs SHOULD use `withEntities`.** Domain IDs are branded strings or numbers so they work as entity IDs; otherwise use `entityConfig` with `selectId`.

### Logic

- **NG-STATE-07: No business decisions in the store.** `withComputed` may derive presentation values and call **pure domain functions** (`canBeCancelled(order)`), since adapters may depend on `domain`. Rules themselves live in `domain`.
- **NG-STATE-08: Async work awaits use cases** (they return `Promise`, TS-D1). Use `rxMethod` only when RxJS operators add value (debounced search, `switchMap` cancellation) and pass the `AbortSignal` through; `signalMethod` for synchronous reactions to signals. A read-only reactive load may use a `resource()` created in `withProps` whose loader calls a use case.
- **NG-STATE-09: Errors are mapped in one place per feature** (ARCH-ADP-05): a feature-level error mapper turns business errors from `domain` into translation keys (`orders.errors.alreadyShipped`). The platform's `TechnicalError` (TS-ARCH-18, already reported where it was created: by the interceptor or the feature's HTTP adapter, NG-OBS-04) becomes a generic key; any other error is a bug, becomes the generic key and goes to `ReportErrorUseCase` (NG-OBS-01/02). The store holds the key, never translated text; the component translates it (NG-I18N-04). Request status uses a shared custom feature (`withRequestStatus`) exported by `src/platform/index.ts`.
  The mapper (`orders-error-keys.ts`, `OrdersErrorKeys`) lives in `adapter/in/ui`, is `@Injectable()` without `providedIn`, and is listed in `<feature>.providers.ts` (NG-ARCH-10). It imports only the feature's `domain`, `src/platform/index.ts` (for `TechnicalError` and the `REPORT_ERROR` token) and nothing from `adapter/out`.
- **NG-STATE-10: Optimistic updates** snapshot state with `getState`, patch, call the use case, and roll back on failure. The UI shows the error (NG-STATE-09).
- **NG-STATE-16: State and methods shared by several stores are one `signalStoreFeature` exported as a constant** (`export const withProjectTime = signalStoreFeature(...)`), never a function returning it: the returned type cannot be written out, so `explicit-module-boundary-types` rejects the function.
- **NG-STATE-17: An `effect` tracks only its declared triggers; the rest of its body runs in `untracked`.** A store method called inside the effect that reads the store's own signals (`ensureOptions()` reading `options()`) otherwise makes the effect re-run, and the load fires twice. The request budget (TS-TEST-14) catches it.
  ```ts
  effect(() => { const week = this.week(); untracked(() => void this.store.load(week)); });
  ```
- **NG-STATE-18 (implements TS-ARCH-21): A store load aborts the previous one, and results are patched with an updater on the current state.** One shared feature from `src/platform` (for example `withLatestLoad`, a `signalStoreFeature` constant, NG-STATE-16) owns one `AbortController` per load key: starting a load aborts the previous controller, the result is applied only while its key is still the current one, and `withHooks({ onDestroy })` aborts what is running. `rxMethod` with `switchMap` that passes the signal on is the alternative where RxJS adds value (NG-STATE-08). After an `await`, the store writes `patchState(store, (s) => ({ week: withCell(s.week, …) }))`, never a value built from `store.week()` read before the `await`. Autosaves on the same item go through a per-key queue (or are coalesced) in the store, and the control shows the saving state (UI-20). Store tests (NG-STATE-14) resolve an older response after a newer one and run two overlapping saves on one key.
  *Why:* a `new AbortController().signal` per call satisfies TS-API-06 literally but cancels nothing, and a patch built from a snapshot undoes the save that finished in between.
- **NG-STATE-11: Stores don't cache backend data across screens.** Shared caching and batching live in the outgoing adapter (TS-ARCH-15, API-N1-04). A store only keeps what its screen shows.

### Scope

- **NG-STATE-12: Provide stores at component or route level by default** (`providers: [OrdersStore]`). `providedIn: 'root'` only for genuinely app-wide state (session, user preferences), which then lives in `src/platform/adapter/in/ui/`. Trivial component-local state uses `signalState` or plain signals.
  *Why:* root stores survive navigation and show stale data on the next visit.

### Not used by default

- **NG-STATE-13: The events plugin (`@ngrx/signals/events`) and classic `@ngrx/store` require an ADR.** Signal Store with methods covers our use cases; a second state paradigm needs a reason.

### Tests and enforcement

- **NG-STATE-14: Store tests are adapter integration tests** (TEST-ARCH-03): `TestBed` with the use-case tokens provided as `mock<UseCase>()` from `vitest-mock-extended` (London, TEST-TDD-07). Assert through the store's public signals. Test the error and rollback paths.
- **NG-STATE-15: Store rules are checked by `@ngrx/eslint-plugin` (`signalsTypeChecked`, [angular-tooling.md](../development/angular-tooling.md)) and dependency-cruiser** (NG-STATE-02).

## Example

```ts
// features/orders/adapter/in/ui/orders-store.ts
interface OrdersState {
  readonly filter: OrderFilter;
  readonly cancelling: OrderId | null;
}

const initialState: OrdersState = { filter: 'open', cancelling: null };

export const OrdersStore = signalStore(
  withState<OrdersState>(initialState),
  withEntities<Order>(),
  withRequestStatus(),
  withComputed(({ entities, filter }) => ({
    visibleOrders: computed(() => entities().filter((o) => matchesFilter(o, filter()))), // domain function
    cancellableIds: computed(() => entities().filter(canBeCancelled).map((o) => o.id)), // domain rule
  })),
  withMethods(
    (store, loadHistory = inject(LOAD_ORDER_HISTORY), cancelOrder = inject(CANCEL_ORDER), errors = inject(OrdersErrorKeys)) => ({
      setFilter(filter: OrderFilter): void {
        patchState(store, { filter });
      },
      async load(customerId: CustomerId): Promise<void> {
        patchState(store, setPending());
        try {
          const orders = await loadHistory.loadOrderHistory(LoadOrderHistoryQuery.of({ customerId }));
          patchState(store, setAllEntities([...orders]), setFulfilled());
        } catch (error) {
          patchState(store, setError(errors.keyFor(error)));
        }
      },
      async cancel(id: OrderId, reason: string): Promise<void> {
        const previous = getState(store);
        patchState(store, { cancelling: id }, updateEntity({ id, changes: markCancelled }));
        try {
          await cancelOrder.cancelOrder(CancelOrderCommand.of({ orderId: id, reason }));
        } catch (error) {
          patchState(store, { entityMap: previous.entityMap, ids: previous.ids }, setError(errors.keyFor(error)));
        } finally {
          patchState(store, { cancelling: null });
        }
      },
    }),
  ),
);
```

```ts
// orders-store.spec.ts
describe('OrdersStore', () => {
  const loadHistory = mock<LoadOrderHistoryUseCase>();
  const cancelOrder = mock<CancelOrderUseCase>();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OrdersStore,
        OrdersErrorKeys, // the real mapper: error mapping is part of the adapter's behaviour
        { provide: LOAD_ORDER_HISTORY, useValue: loadHistory },
        { provide: CANCEL_ORDER, useValue: cancelOrder },
        { provide: REPORT_ERROR, useValue: mock<ReportErrorUseCase>() },
      ],
    });
  });

  it('rolls back a cancellation the backend rejected', async () => {
    const store = TestBed.inject(OrdersStore);
    loadHistory.loadOrderHistory.mockResolvedValue([anOpenOrder('o-1')]);
    cancelOrder.cancelOrder.mockRejectedValue(new OrderAlreadyShipped('o-1'));
    await store.load(aCustomerId());

    await store.cancel(orderId('o-1'), 'Ordered twice');

    expect(store.entityMap()[orderId('o-1')]?.status).toBe('open');
    expect(store.error()).toBe('orders.errors.alreadyShipped'); // a key; the component translates it
  });
});
```

## Skill overrides (`ngrx-signals` original by danielsogl)

Our own `ngrx-signals` skill already follows this doc. For reference, the original skill's advice we changed:

| Original skill | Our rule |
|---|---|
| Store/service split: store injects an API service that does HTTP | Store injects use-case contracts (NG-STATE-02) |
| `providedIn: 'root'` in the canonical scaffold | Component/route scope by default (NG-STATE-12) |
| `type FooState = {…}` | `interface` (NG-STATE-05, stylistic lint) |
| Tests mock services with hand-written `vi.fn()` objects | `mock<Contract>()` from vitest-mock-extended (NG-STATE-14) |

*Agent checklist in [checklists/angular.md](../../checklists/angular.md) and sources in [sources.md](../../sources.md), section "Angular State Management: NgRx Signal Store".*
