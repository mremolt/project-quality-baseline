# @ngrx/signals — Custom Store Features

`signalStoreFeature` is the composition primitive. A custom feature is a function that returns a feature; the body uses the same `withState`/`withComputed`/`withMethods`/`withHooks` calls as a store.

Placement: features shared across features live in `src/platform/adapter/in/ui/state/` (e.g. `with-request-status.ts`, NG-STATE-09); features used by one feature live next to its store in `features/<feature>/adapter/in/ui/`.

## Why custom features

- **Reuse.** `withRequestStatus()`, `withLogger('orders')`, `withSelectedEntity<T>()` get added to many stores.
- **Cohesion.** Keep related state, computed, and methods in one named unit instead of scattering them across the store.
- **Type-safety across stores.** Features can declare what they expect from the host store, so you can't accidentally compose `withSelectedEntity` onto a store that doesn't have entities.

## Pattern: `withRequestStatus`

The canonical example. Every store with async loading wants this. Ours lives in `src/platform/adapter/in/ui/state/with-request-status.ts`.

```typescript
import { computed } from '@angular/core';
import { signalStoreFeature, withComputed, withState } from '@ngrx/signals';

export type RequestStatus = 'idle' | 'pending' | 'fulfilled' | { readonly error: string };

export interface RequestStatusState {
  readonly requestStatus: RequestStatus;
}

export function withRequestStatus() {
  return signalStoreFeature(
    withState<RequestStatusState>({ requestStatus: 'idle' }),
    withComputed(({ requestStatus }) => ({
      isPending: computed(() => requestStatus() === 'pending'),
      isFulfilled: computed(() => requestStatus() === 'fulfilled'),
      error: computed(() => {
        const s = requestStatus();
        return typeof s === 'object' ? s.error : null;
      }),
    })),
  );
}

// Standalone updaters — return Partial<State>, callable via patchState(store, setX()).
export function setPending(): RequestStatusState {
  return { requestStatus: 'pending' };
}
export function setFulfilled(): RequestStatusState {
  return { requestStatus: 'fulfilled' };
}
export function setError(error: string): RequestStatusState {
  return { requestStatus: { error } };
}
```

`setError` takes a **translation key**: the store passes `errors.keyFor(error)` from the feature's error mapper, never `error.message` or translated text; the component translates the key (NG-STATE-09, NG-I18N-04).

Use it:

```typescript
import { setError, setFulfilled, setPending, withRequestStatus } from '../../../../../platform'; // index.ts only (NG-ARCH-04)

interface OrdersState {
  readonly orders: readonly Order[];
}

export const OrdersStore = signalStore(
  withState<OrdersState>({ orders: [] }),
  withRequestStatus(),
  withMethods((store, loadHistory = inject(LOAD_ORDER_HISTORY), errors = inject(OrdersErrorKeys)) => ({
    async load(customerId: CustomerId): Promise<void> {
      patchState(store, setPending());
      try {
        const orders = await loadHistory.loadOrderHistory(LoadOrderHistoryQuery.of({ customerId }));
        patchState(store, { orders }, setFulfilled());
      } catch (error) {
        patchState(store, setError(errors.keyFor(error)));
      }
    },
  })),
);
```

## Pattern: `withLogger`

Logs every state change in dev. Good intro to `withHooks` + `watchState`.

```typescript
import { signalStoreFeature, watchState, withHooks } from '@ngrx/signals';

export function withLogger(name: string) {
  return signalStoreFeature(
    withHooks({
      onInit(store) {
        // watchState fires synchronously on every change; effect() would batch.
        watchState(store, (state) => console.log(`[${name}]`, state));
      },
    }),
  );
}
```

Add it as the **last** feature so it sees the fully-assembled state.

## Pattern: typed feature with input requirements

Sometimes a feature only makes sense on top of another (`withSelectedEntity` needs `withEntities`). Use the typed `signalStoreFeature` overload to declare what you require.

```typescript
import { computed } from '@angular/core';
import { patchState, signalStoreFeature, type, withComputed, withMethods, withState } from '@ngrx/signals';
import type { EntityId, EntityState } from '@ngrx/signals/entities';

interface SelectedEntityState {
  readonly selectedId: EntityId | null;
}

export function withSelectedEntity<T extends { id: EntityId }>() {
  return signalStoreFeature(
    // Declare the prerequisite shape.
    { state: type<EntityState<T>>() },
    withState<SelectedEntityState>({ selectedId: null }),
    withComputed(({ selectedId, entityMap }) => ({
      selectedEntity: computed(() => {
        const id = selectedId();
        return id == null ? null : (entityMap()[id] ?? null);
      }),
    })),
    withMethods((store) => ({
      select(id: EntityId): void {
        patchState(store, { selectedId: id });
      },
      clearSelection(): void {
        patchState(store, { selectedId: null });
      },
    })),
  );
}

// Usage — order matters: withEntities first.
export const OrdersStore = signalStore(withEntities<Order>(), withSelectedEntity<Order>());
```

Compile-time error if you put `withSelectedEntity` on a store without `withEntities`. That's the whole point of the typed declaration.

A feature that needs another **custom** feature can reuse its type instead of redeclaring it, via `SignalStoreFeatureType` (v22):

```typescript
import { signalStoreFeature, type SignalStoreFeatureType, type, withComputed } from '@ngrx/signals';

type RequestStatusFeature = SignalStoreFeatureType<typeof withRequestStatus>;

export function withLoadGuard() {
  return signalStoreFeature(
    type<RequestStatusFeature>(),
    withComputed(({ isPending }) => ({ canLoad: () => !isPending() })),
  );
}
```

## Pattern: `withFeature` for passing store members into a feature

A generic feature shouldn't know the host store's method names. `withFeature(factory)` gives the factory the store-so-far (state, props, methods), so you can hand specific members to the feature as plain arguments.

```typescript
import { inject } from '@angular/core';
import { signalStore, withFeature, withMethods } from '@ngrx/signals';

export const OrderDetailStore = signalStore(
  withMethods((store, loadOrder = inject(LOAD_ORDER)) => ({
    loadById(id: OrderId): Promise<Order> {
      return loadOrder.loadOrder(LoadOrderQuery.of({ orderId: id }));
    },
  })),
  // withEntityLoader(load: (id: OrderId) => Promise<Order>) stays store-agnostic.
  withFeature((store) => withEntityLoader((id: OrderId) => store.loadById(id))),
);
```

Most of the time you won't need this — prefer the plain function form.

## Composition rules

- A feature is just a function. Name it `withXxx`. Return `signalStoreFeature(...)`. File name is kebab-case (`with-selected-entity.ts`).
- Order matters. Features can only see what's been declared **above** them.
- Keep features small. If `withCart` adds 5 state slices and 12 methods, it's not a feature, it's a store.
- Test features in isolation by wrapping them in a minimal `signalStore` (see `testing.md`).

## When NOT to use a custom feature

- Logic used in only one store. Just inline it.
- "Generic" wrappers around `inject()`. Inject the dependency where it's used.
- Business rules. Those are pure functions in `domain` (NG-STATE-07).
- Anything that does I/O, caching or batching. I/O goes behind a use case and an outgoing port; caching and batching go into an outgoing-adapter decorator (NG-STATE-11, TS-ARCH-15). A feature may call a use case it receives as an argument, but never `HttpClient` or an outgoing port.
