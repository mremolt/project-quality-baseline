# @ngrx/signals — Architectural Patterns

The "how should I structure this?" answers, applied to our hexagonal frontend. Rules are in `docs/angular/state-management.md` (NG-STATE-*) and `docs/typescript/frontend-architecture.md` (TS-ARCH-*); this file shows how they look in code.

## Table of contents

- [Store / use-case split](#store--use-case-split)
- [Scoping: component vs route vs root](#scoping-component-vs-route-vs-root)
- [Optimistic updates with rollback](#optimistic-updates-with-rollback)
- [Refactoring `BehaviorSubject` services](#refactoring-behaviorsubject-services)
- [Lifecycle: triggering loads](#lifecycle-triggering-loads)
- [No cross-store imports](#no-cross-store-imports)
- [Loading + error UX](#loading--error-ux)
- [Where caching and batching go](#where-caching-and-batching-go)

## Store / use-case split

The single most important rule: **the store holds view state, the use case does the work** (NG-STATE-02, TS-ARCH-03).

```
OrdersPage (template)
   │  reads signals, calls methods
   ▼
OrdersStore                     adapter/in/ui   view state: filter, selection, orders, request status
   │  inject(LOAD_ORDER_HISTORY)                 token from orders.providers.ts (TS-ARCH-09)
   ▼
LoadOrderHistoryUseCase         ports/in        contract, returns Promise (TS-D1)
   ▲  implemented by
LoadOrderHistoryService         application     orchestrates domain + outgoing ports
   │
   ▼
LoadOrdersPort                  ports/out
   ▲  implemented by
HttpOrdersAdapter               adapter/out/http   HTTP, DTO → domain mapping, zod parsing
```

Files of the orders feature:

```
src/features/orders/
  domain/order.ts                         ← Order, OrderId, canBeCancelled(), markCancelled()
  ports/in/load-order-history.ts          ← LoadOrderHistoryUseCase + LoadOrderHistoryQuery (zod factory)
  ports/out/load-orders-port.ts           ← LoadOrdersPort
  application/load-order-history-service.ts
  adapter/in/ui/orders-store.ts           ← the Signal Store
  adapter/in/ui/orders-error-messages.ts  ← feature error mapper (NG-STATE-09)
  adapter/in/ui/orders-page.ts
  adapter/out/http/http-orders-adapter.ts
  orders.providers.ts                     ← tokens + wiring
```

The contract the store depends on (framework-free, `Promise`-based, TS-D1):

```typescript
// ports/in/load-order-history.ts
export interface LoadOrderHistoryUseCase {
  loadOrderHistory(query: LoadOrderHistoryQuery, signal?: AbortSignal): Promise<readonly Order[]>;
}
```

The token lives in the composition root, because `InjectionToken` is an Angular type (TS-ARCH-09):

```typescript
// orders.providers.ts
export const LOAD_ORDER_HISTORY = new InjectionToken<LoadOrderHistoryUseCase>('LoadOrderHistory');
export const CANCEL_ORDER = new InjectionToken<CancelOrderUseCase>('CancelOrder');
```

The store injects the token, never the implementation:

```typescript
// adapter/in/ui/orders-store.ts
export const OrdersStore = signalStore(
  withState<OrdersState>(initialState),
  withEntities<Order>(),
  withRequestStatus(),
  withMethods((store, loadHistory = inject(LOAD_ORDER_HISTORY), errors = inject(OrdersErrorMessages)) => ({
    async load(customerId: CustomerId): Promise<void> {
      patchState(store, setPending());
      try {
        const orders = await loadHistory.loadOrderHistory(LoadOrderHistoryQuery.of({ customerId }));
        patchState(store, setAllEntities([...orders]), setFulfilled());
      } catch (error) {
        patchState(store, setError(errors.messageFor(error)));
      }
    },
  })),
);
```

Why:

- **Incoming adapter → incoming port.** The store is a UI adapter; it reaches the core only through use-case contracts (ARCH-ADP-02).
- **Testable in isolation.** Tests provide `mock<LoadOrderHistoryUseCase>()` for the token (NG-STATE-14).
- **Replaceable backend.** Swap the HTTP adapter for GraphQL/IndexedDB in the providers file; store and use case don't change.
- **No DTOs in the UI.** The adapter maps DTO → domain; the store only ever sees `Order` (NG-STATE-04, TS-ARCH-05).

If you find `inject(HttpClient)`, a generated API service, an outgoing port or an `adapter/out` import inside a store, call it out (NG-STATE-02). dependency-cruiser will fail the build anyway (NG-STATE-15).

If the use case doesn't exist yet: write the contract in `ports/in`, the token in the providers file, then the store against the token (test first, London style). The application service and adapter can follow in their own TDD cycles.

## Scoping: component vs route vs root

| Scope                     | Provider                                                    | Use when                                                         |
| ------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| Component-scoped (default) | `providers: [OrdersStore]` on the page/component           | Screen state, per-instance editor state, per-dialog state        |
| Route-scoped (default)    | `providers: [...ordersProviders, OrdersStore]` on the route | State shared by the components under one route                   |
| Component-local only      | `signalState({...})` or plain `signal()` in the component   | Trivially local, never injected elsewhere                        |
| App-wide singleton        | `signalStore({ providedIn: 'root' }, ...)`                  | Session, current user, user preferences; lives in `src/platform` |

Component/route scope is the default (NG-STATE-12). Putting screen state in `root` makes it survive navigation and show stale data on the next visit. "We don't want to refetch" is not a reason for root: that's caching, and caching belongs in the outgoing adapter ([below](#where-caching-and-batching-go)).

## Optimistic updates with rollback

Snapshot, patch optimistically, call the use case, roll back and show a mapped error on failure (NG-STATE-10, NG-STATE-09).

```typescript
withMethods((store, cancelOrder = inject(CANCEL_ORDER), errors = inject(OrdersErrorMessages)) => ({
  async cancel(id: OrderId): Promise<void> {
    const previous = getState(store);
    patchState(store, { cancelling: id }, updateEntity({ id, changes: markCancelled })); // markCancelled: domain function
    try {
      await cancelOrder.cancelOrder(CancelOrderCommand.of({ orderId: id }));
    } catch (error) {
      patchState(store, { entityMap: previous.entityMap, ids: previous.ids }, setError(errors.messageFor(error)));
    } finally {
      patchState(store, { cancelling: null });
    }
  },
}));
```

Notes:

- For entity stores, restore both `entityMap` and `ids` (the entity feature uses both as state slices).
- Surface the failure in state (`setError(...)`) so the UI explains why the change "un-stuck". Rethrowing as well is fine when the caller needs it, but the store must not leave the user without feedback.
- Whether an order *may* be cancelled is decided by `canBeCancelled` in `domain` and enforced by the use case; the store only reflects it (NG-STATE-07).
- Test the rollback path with a rejecting mock (`cancelOrder.cancelOrder.mockRejectedValue(...)`, see `testing.md`).

## Refactoring `BehaviorSubject` services

Common legacy shape: one root service that holds state, does HTTP and contains rules.

```typescript
// before
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly _orders$ = new BehaviorSubject<OrderDto[]>([]);
  readonly orders$ = this._orders$.asObservable();
  readonly cancellable$ = this.orders$.pipe(map((os) => os.filter((o) => o.status === 'open' && !o.shippedAt)));

  load(customerId: string): void {
    this.http.get<OrderDto[]>(`/api/customers/${customerId}/orders`).subscribe((os) => {
      this._orders$.next(os);
    });
  }
}
```

It splits along the hexagon, not into "store + API service":

| Piece of the old service                         | Goes to                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `OrderDto`, `HttpClient` call                    | `adapter/out/http/http-orders-adapter.ts` implementing `LoadOrdersPort`, maps DTO → `Order` |
| `o.status === 'open' && !o.shippedAt`            | `domain/order.ts`: `canBeCancelled(order)`                                                 |
| "load orders for a customer" orchestration       | `application/load-order-history-service.ts` implementing `LoadOrderHistoryUseCase`          |
| `BehaviorSubject`s, `.next`, derived observables | `adapter/in/ui/orders-store.ts` (Signal Store)                                             |
| `providedIn: 'root'`                             | `providers: [OrdersStore]` on the page/route (NG-STATE-12)                                 |

The new store:

```typescript
// adapter/in/ui/orders-store.ts
export const OrdersStore = signalStore(
  withEntities<Order>(),
  withRequestStatus(),
  withComputed(({ entities }) => ({
    cancellable: computed(() => entities().filter(canBeCancelled)),
  })),
  withMethods((store, loadHistory = inject(LOAD_ORDER_HISTORY), errors = inject(OrdersErrorMessages)) => ({
    async load(customerId: CustomerId): Promise<void> {
      patchState(store, setPending());
      try {
        const orders = await loadHistory.loadOrderHistory(LoadOrderHistoryQuery.of({ customerId }));
        patchState(store, setAllEntities([...orders]), setFulfilled());
      } catch (error) {
        patchState(store, setError(errors.messageFor(error)));
      }
    },
  })),
);
```

The consumer drops the `async` pipe and reads signals:

```html
<!-- before -->
@for (order of orders$ | async; track order.id) { <app-order-row [order]="order" /> }

<!-- after -->
@for (order of store.entities(); track order.id) { <app-order-row [order]="order" /> }
<p>{{ store.cancellable().length }} orders can still be cancelled</p>
```

Migration checklist:

- `BehaviorSubject<T>` → state slice in `withState<FooState>` (interface) or `withEntities<T>()`.
- `.next(...)` → `patchState(store, ...)`.
- Derived observables → `withComputed`; any business rule inside them → domain function.
- HTTP → outgoing port + HTTP adapter; orchestration → use case; store calls the use-case token.
- DTO types disappear from the UI; the store holds domain values.
- `providedIn: 'root'` → component/route providers unless genuinely app-wide.
- If public `orders$` consumers must keep working during migration, expose `toObservable(store.entities)` from the component temporarily, not from the store.
- Write store tests with `mock<LoadOrderHistoryUseCase>()` before deleting the old service.

## Lifecycle: triggering loads

**Load once when the store is created** with `withHooks`. Use the factory form when the hook needs `inject()`:

```typescript
export const PreferencesStore = signalStore(
  { providedIn: 'root' }, // app-wide: lives in src/platform/adapter/in/ui/
  withState<PreferencesState>(initialPreferences),
  withRequestStatus(),
  withMethods((store, loadPreferences = inject(LOAD_PREFERENCES), errors = inject(PreferencesErrorMessages)) => ({
    async load(): Promise<void> {
      patchState(store, setPending());
      try {
        const preferences = await loadPreferences.loadPreferences();
        patchState(store, { preferences }, setFulfilled());
      } catch (error) {
        patchState(store, setError(errors.messageFor(error)));
      }
    },
  })),
  withHooks({
    onInit(store) {
      void store.load();
    },
  }),
);
```

For a component/route-scoped store this fires once per provider instance, i.e. per navigation to the screen — usually exactly what you want.

**Loads driven by a route parameter or input**: bind the route param as a component input (`withComponentInputBinding()`), and connect it to the store with a `signalMethod`, so the load re-runs when the input changes:

```typescript
// orders-store.ts — a second withMethods so it can call load() from the first
withMethods((store) => ({
  loadFor: signalMethod<CustomerId>((customerId) => {
    void store.load(customerId);
  }),
})),
```

```typescript
// orders-page.ts
export class OrdersPage {
  readonly customerId = input.required<CustomerId>();
  protected readonly store = inject(OrdersStore);

  constructor() {
    this.store.loadFor(this.customerId); // injection context: the constructor
  }
}
```

If the input can change faster than responses arrive, a stale response may overwrite a newer one. Then use `rxMethod` with `switchMap` + `fromAbortable` (cancels the in-flight use-case call) or a `resource()` in `withProps` whose loader passes the `abortSignal` to the use case (NG-STATE-08). Both are in `api-reference.md`.

## No cross-store imports

A store never `inject(OtherStore)`s and never imports another store (NG-STATE-02). Cross-feature data comes through the other feature's public contracts in its `index.ts` (NG-STATE-03, TS-ARCH-10).

Allowed alternatives:

1. **Call a use case.** If the orders screen needs customer data, the customers feature exports a use-case contract and token from its `index.ts`; the orders store (or the orders use case) calls it.
2. **Lift the shared view state up** to a higher-scoped store that both components inject (one store, two consumers).
3. **Compose via a custom feature** (`signalStoreFeature`) so both stores include the same slice shape (they still hold separate state).
4. **Pass values through component inputs** from a parent that owns the store.

"Logout clears cart and profile" in our architecture is usually solved by scoping: route/component stores die with their screen; app-wide state in `src/platform` exposes a `reset()` method called from the logout flow. The events plugin is an option only with an ADR (NG-STATE-13).

## Loading + error UX

Pair every async method with the shared request status and translate errors in one place per feature (NG-STATE-09).

The feature error mapper (`adapter/in/ui/orders-error-messages.ts`): business errors from `domain` become user messages, everything else becomes a generic message plus logging.

```typescript
import { inject, Injectable } from '@angular/core';

import { Logger } from '../../../../../platform/adapter/out/logging/logger';
import { OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';

@Injectable({ providedIn: 'root' }) // stateless helper, not state, so root is fine
export class OrdersErrorMessages {
  private readonly logger = inject(Logger);

  messageFor(error: unknown): string {
    if (error instanceof OrderAlreadyShipped) {
      return 'This order has already been shipped.';
    }
    if (error instanceof OrderNotFound) {
      return 'This order no longer exists.';
    }
    this.logger.error('Unexpected orders error', error);
    return 'Something went wrong. Please try again.';
  }
}
```

The store only ever calls `setError(errors.messageFor(error))`; it never shows `error.message` or inspects HTTP status codes (those are mapped to domain errors in the HTTP adapter).

In the template:

```html
@if (store.isPending()) { <app-spinner /> }
@if (store.error(); as message) { <app-error-banner [message]="message" /> }
@if (store.isFulfilled()) {
  <ul>
    @for (order of store.visibleOrders(); track order.id) { <li>{{ order.number }}</li> }
  </ul>
}
```

The pending / fulfilled / error triple covers most UI loading needs and avoids a bare `isLoading` boolean that can't represent failure. `withRequestStatus` comes from `src/platform/adapter/in/ui/state/` (see `custom-features.md`).

## Where caching and batching go

Not in the store (NG-STATE-11). A store keeps what its screen shows; caching backend data across screens, request coalescing and batching are concerns of the **outgoing adapter**, as a decorator implementing the same port (TS-ARCH-15, API-N1-04). Use case and store stay unaware of it.

```typescript
// adapter/out/http/caching-load-orders-adapter.ts
interface CacheEntry {
  readonly at: number;
  readonly orders: Promise<readonly Order[]>;
}

export class CachingLoadOrdersAdapter implements LoadOrdersPort {
  private readonly cache = new Map<CustomerId, CacheEntry>();

  constructor(
    private readonly inner: LoadOrdersPort,
    private readonly ttlMs = 30_000,
  ) {}

  loadOrders(customerId: CustomerId): Promise<readonly Order[]> {
    const hit = this.cache.get(customerId);
    if (hit !== undefined && Date.now() - hit.at < this.ttlMs) {
      return hit.orders; // also coalesces concurrent requests for the same customer
    }
    const orders = this.inner.loadOrders(customerId);
    this.cache.set(customerId, { at: Date.now(), orders });
    void orders.catch(() => this.cache.delete(customerId)); // don't cache failures
    return orders;
  }
}
```

```typescript
// orders.providers.ts
export const ordersProviders: Provider[] = [
  HttpOrdersAdapter,
  { provide: LOAD_ORDERS_PORT, useFactory: () => new CachingLoadOrdersAdapter(inject(HttpOrdersAdapter)) },
  {
    provide: LOAD_ORDER_HISTORY,
    useFactory: (port: LoadOrdersPort) => new LoadOrderHistoryService(port),
    deps: [LOAD_ORDERS_PORT],
  },
];
```

The cache lives as long as the injector that provides it: providers on a route give a per-route cache; a cache that must survive navigation is provided in a longer-lived injector (e.g. the app config), still as an adapter, never as a root store. Cache invalidation after commands (cancel, update) is part of the adapter's contract and tested there (TS-TEST-04, API-N1-06).
