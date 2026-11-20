# Angular State Management: NgRx Signal Store

How `@ngrx/signals` Signal Stores fit into the hexagonal frontend. Short version: **a Signal Store is the view state of the incoming UI adapter.** It holds what the screen shows and forwards user intent to use cases. It is not a data layer and not a place for business rules.

Implements: [TS-ARCH-03](../typescript/frontend-architecture.md), [ARCH-ADP-02](../shared/architecture/adapters.md), [ARCH-UC-02](../shared/architecture/use-cases.md). The `ngrx-signals` skill (our adaptation) contains the API know-how and follows these rules.

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
- **NG-STATE-02: Store methods call use-case contracts only**, injected through the tokens of the feature's providers file (TS-ARCH-08/09). A store MUST NOT inject `HttpClient`, generated API services, outgoing ports, adapters, or another store.
  *Why:* the store is an incoming adapter; incoming adapters reach the core only through incoming ports (ARCH-ADP-02).
- **NG-STATE-03: Cross-feature data comes through the other feature's public contracts** (`index.ts`, TS-ARCH-10), never by injecting its store.

### State

- **NG-STATE-04: State contains UI state** (filters, selection, dialog/edit mode, request status) **and use-case results or domain values.** Never backend DTOs. Values are immutable (`readonly`).
- **NG-STATE-05: State is typed with an explicit `interface`** (`withState<OrdersState>(initialState)`), and stays protected (default). Mutations happen only through store methods. Tests seed state with `unprotected()` from `@ngrx/signals/testing`.
- **NG-STATE-06: Collections with stable IDs use `withEntities`.** Domain IDs are branded strings or numbers so they work as entity IDs; otherwise use `entityConfig` with `selectId`.

### Logic

- **NG-STATE-07: No business decisions in the store.** `withComputed` may derive presentation values and call **pure domain functions** (`canBeCancelled(order)`), since adapters may depend on `domain`. Rules themselves live in `domain`.
- **NG-STATE-08: Async work awaits use cases** (they return `Promise`, TS-D1). Use `rxMethod` only when RxJS operators add value (debounced search, `switchMap` cancellation) and pass the `AbortSignal` through; `signalMethod` for synchronous reactions to signals. A read-only reactive load may use a `resource()` created in `withProps` whose loader calls a use case.
- **NG-STATE-09: Errors are translated in one place per feature** (ARCH-ADP-05): business errors from `domain` become user messages via a feature-level error mapper; technical errors become a generic message plus logging. Request status uses a shared custom feature (`withRequestStatus`) from `src/platform/adapter/in/ui/state/`.
- **NG-STATE-10: Optimistic updates** snapshot state with `getState`, patch, call the use case, and roll back on failure. The UI shows the error (NG-STATE-09).
- **NG-STATE-11: Stores don't cache backend data across screens.** Shared caching and batching live in the outgoing adapter (TS-ARCH-15, API-N1-04). A store only keeps what its screen shows.

### Scope

- **NG-STATE-12: Provide stores at component or route level by default** (`providers: [OrdersStore]`). `providedIn: 'root'` only for genuinely app-wide state (session, user preferences), which then lives in `src/platform/adapter/in/ui/`. Trivial component-local state uses `signalState` or plain signals.
  *Why:* root stores survive navigation and show stale data on the next visit.

### Not used by default

- **NG-STATE-13: The events plugin (`@ngrx/signals/events`) and classic `@ngrx/store` require an ADR.** Signal Store with methods covers our use cases; a second state paradigm needs a reason.

### Tests and enforcement

- **NG-STATE-14: Store tests are adapter integration tests** (TEST-ARCH-03): `TestBed` with the use-case tokens provided as `mock<UseCase>()` from `vitest-mock-extended` (London, TEST-TDD-07). Assert through the store's public signals. Test the error and rollback paths.
- **NG-STATE-15: `@ngrx/eslint-plugin` with `signalsTypeChecked` is active** ([tooling.md](tooling.md)), and dependency-cruiser forbids `*-store.ts` from importing `adapter/out`, `@angular/common/http` and generated code.

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
    (store, loadHistory = inject(LOAD_ORDER_HISTORY), cancelOrder = inject(CANCEL_ORDER), errors = inject(OrdersErrorMessages)) => ({
      setFilter(filter: OrderFilter): void {
        patchState(store, { filter });
      },
      async load(customerId: CustomerId): Promise<void> {
        patchState(store, setPending());
        try {
          const orders = await loadHistory.loadOrderHistory(LoadOrderHistoryQuery.of({ customerId }));
          patchState(store, setAllEntities([...orders]), setFulfilled());
        } catch (error) {
          patchState(store, setError(errors.messageFor(error)));
        }
      },
      async cancel(id: OrderId): Promise<void> {
        const previous = getState(store);
        patchState(store, { cancelling: id }, updateEntity({ id, changes: markCancelled }));
        try {
          await cancelOrder.cancelOrder(CancelOrderCommand.of({ orderId: id }));
        } catch (error) {
          patchState(store, { entityMap: previous.entityMap, ids: previous.ids }, setError(errors.messageFor(error)));
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
        { provide: LOAD_ORDER_HISTORY, useValue: loadHistory },
        { provide: CANCEL_ORDER, useValue: cancelOrder },
      ],
    });
  });

  it('rolls back a cancellation the backend rejected', async () => {
    const store = TestBed.inject(OrdersStore);
    loadHistory.loadOrderHistory.mockResolvedValue([anOpenOrder('o-1')]);
    cancelOrder.cancelOrder.mockRejectedValue(new OrderAlreadyShipped('o-1'));
    await store.load(aCustomerId());

    await store.cancel(orderId('o-1'));

    expect(store.entityMap()[orderId('o-1')]?.status).toBe('open');
    expect(store.error()).toBe('This order has already been shipped.');
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

## Agent checklist

- [ ] Store in `adapter/in/ui`, injecting only use-case tokens?
- [ ] No DTOs, no HTTP, no other stores, no business rules in the store?
- [ ] Scoped to component/route unless genuinely app-wide?
- [ ] Error and rollback paths tested with mocked use cases?

## Sources

NgRx Signal Store guide (ngrx.io/guide/signals/signal-store). API patterns adapted from the `ngrx-signals` skill by Daniel Sogl (github.com/danielsogl/skills, MIT). Architecture placement: this baseline.
