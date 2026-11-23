---
name: ngrx-signals
description: Build, refactor, and architect Angular view state with the @ngrx/signals Signal Store, following our hexagonal frontend rules (the store is the incoming UI adapter's view state and calls use cases through injection tokens; no HTTP, no outgoing ports, no other stores). Use whenever the user mentions signalStore, withState, withMethods, withComputed, withHooks, withLinkedState, withProps, withFeature, signalStoreFeature, withEntities, rxMethod, signalMethod, patchState, getState, watchState, signalState, unprotected, the SignalStore events plugin (withReducer, withEventHandlers), or wants to refactor BehaviorSubject/service-based state to Signal Store. Also use for custom store features, request status, optimistic updates with rollback, entity collections, store scoping, store tests, and the store/use-case split in Angular. Do NOT use for @ngrx/store (classic Redux), createReducer/createEffect, or generic RxJS questions unrelated to Signal Store.
metadata:
  upstream-repo: danielsogl/skills
  upstream-path: skills/ngrx-signals
  upstream-commit: 63095ae4bf894465f6c1279a07a5e226377f5502
  license: MIT (adapted; see LICENSE.upstream)
---

# NgRx Signal Store (baseline edition)

Signal-based view state for Angular, placed inside our hexagonal frontend. This skill produces idiomatic, type-safe `@ngrx/signals` code that obeys the baseline's architecture rules.

## Baseline rules first

Before generating or reviewing store code, read **`docs/baseline/08-crosscutting-concepts/ui/angular-state-management.md`** (NG-STATE-01..17) and, for layout and wiring, `docs/baseline/05-building-block-view/typescript.md` (TS-ARCH-*). For tests also `docs/baseline/08-crosscutting-concepts/testing/typescript.md` (TS-TEST-*) and `docs/baseline/08-crosscutting-concepts/testing/tdd.md`.

**If this skill and the docs disagree, the docs win.** Cite rule IDs (`NG-STATE-02`, `TS-ARCH-03`) when explaining a decision instead of restating the rule.

## When to use this skill

Trigger on any of these signals:

- The user names the API: `signalStore`, `signalStoreFeature`, `withState`, `withMethods`, `withComputed`, `withLinkedState`, `withHooks`, `withProps`, `withFeature`, `withEntities`, `rxMethod`, `signalMethod`, `patchState`, `getState`, `watchState`, `signalState`, or `@ngrx/signals/events` / `@ngrx/signals/testing`.
- The user wants to **refactor** a service that uses `BehaviorSubject`/`Subject` or a class with mutable fields into a Signal Store.
- The user asks for **screen/feature view state** in Angular with signals or a "modern" approach.
- The user wants a **custom store feature** (`withRequestStatus`, `withSelectedEntity`, `withLogger`, ...) or asks how to compose features.
- The user asks about **optimistic updates**, **request status**, **entity collections**, or **loading/saving data** from an Angular screen.

Do NOT use for classic `@ngrx/store` (actions, reducers, effects, separate-file selectors), Redux DevTools wiring without Signal Store, or pure RxJS pipeline questions. Classic `@ngrx/store` and the events plugin need an ADR anyway (NG-STATE-13).

## Mental model

A Signal Store is a tree of composed **features**. Each feature contributes state, computed signals, methods, props, or lifecycle hooks. Composition happens at definition time:

```typescript
export const OrdersStore = signalStore(
  withState<OrdersState>(initialState), // UI state + use-case results (interface-typed)
  withEntities<Order>(), // domain values with stable IDs
  withComputed(/* ... */), // presentation values, pure domain functions
  withProps(/* ... */), // non-reactive deps & values (often via inject())
  withMethods(/* ... */), // user intent -> use case -> patchState
  withHooks({ onInit, onDestroy }),
);
```

Where it sits in the hexagon (NG-STATE-01/02, TS-ARCH-03):

```
component ──▶ OrdersStore (adapter/in/ui) ──▶ LOAD_ORDER_HISTORY token ──▶ LoadOrderHistoryUseCase (ports/in)
                                                                                │ implemented by
                                                                                ▼
                                                     application service ──▶ outgoing port ◀── HTTP adapter
```

Four rules every store author needs to internalize:

1. **The store is view state of the UI adapter.** It holds what the screen shows and forwards user intent to use cases. It is not a data layer and makes no business decisions (NG-STATE-07).
2. **State updates go through `patchState(store, updater)`.** Updaters are a partial object, a function `(state) => Partial<State>`, or a custom updater returning one of those.
3. **Stores are Angular providers, scoped to a component or route by default** (`providers: [OrdersStore]`, NG-STATE-12). `providedIn: 'root'` only for app-wide state living in `src/platform/adapter/in/ui/`.
4. **Composition over inheritance.** Reuse comes from custom features built with `signalStoreFeature(...)`.

## Canonical scaffold (use as a starting point)

This is the shape from `docs/baseline/08-crosscutting-concepts/ui/angular-state-management.md`. File: `src/features/orders/adapter/in/ui/orders-store.ts`.

```typescript
import { computed, inject } from '@angular/core';
import { getState, patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, updateEntity, withEntities } from '@ngrx/signals/entities';

import { setError, setFulfilled, setPending, withRequestStatus } from '../../../../../platform'; // index.ts only (NG-ARCH-04)
import {
  canBeCancelled,
  type CustomerId,
  markCancelled,
  matchesFilter,
  type Order,
  type OrderFilter,
  type OrderId,
} from '../../../domain/order';
import { CANCEL_ORDER, LOAD_ORDER_HISTORY } from '../../../orders.tokens'; // never from orders.providers (TS-ARCH-17)
import { CancelOrderCommand } from '../../../ports/in/cancel-order-command';
import { LoadOrderHistoryQuery } from '../../../ports/in/load-order-history-query';
import { OrdersErrorKeys } from './orders-error-keys';

interface OrdersState {
  readonly filter: OrderFilter;
  readonly cancelling: OrderId | null;
}

const initialState: OrdersState = { filter: 'open', cancelling: null };

// No providedIn: provided by the orders page/route (NG-STATE-12).
export const OrdersStore = signalStore(
  withState<OrdersState>(initialState),
  withEntities<Order>(),
  withRequestStatus(),
  withComputed(({ entities, filter }) => ({
    visibleOrders: computed(() => entities().filter((o) => matchesFilter(o, filter()))), // domain function
    cancellableIds: computed(() => entities().filter(canBeCancelled).map((o) => o.id)), // domain rule
  })),
  withMethods(
    (
      store,
      loadHistory = inject(LOAD_ORDER_HISTORY),
      cancelOrder = inject(CANCEL_ORDER),
      errors = inject(OrdersErrorKeys),
    ) => ({
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

What the scaffold relies on:

- `LOAD_ORDER_HISTORY` / `CANCEL_ORDER` are `InjectionToken<LoadOrderHistoryUseCase>` / `InjectionToken<CancelOrderUseCase>` declared in `orders.tokens.ts` (TS-ARCH-17). The contracts live in `ports/in` and return `Promise` (TS-D1).
- `LoadOrderHistoryQuery.of(...)` / `CancelOrderCommand.of(...)` are zod-validated factories next to the contract (TS-ARCH-06, TS-D2), typed `of(input: z.input<typeof Schema>)`, never `unknown`: a missing field (here `reason`) is a compile error, not a runtime throw.
- `OrdersErrorKeys` is the feature-level error mapper in `adapter/in/ui` (NG-STATE-09): `@Injectable()` without `providedIn`, listed in `orders.providers.ts`. It returns translation keys; the store holds the key and the component translates it (NG-I18N-04).
- `withRequestStatus` is the shared feature from `src/platform/adapter/in/ui/state/`, imported through `src/platform/index.ts` (NG-STATE-09, NG-ARCH-04).
- File names follow NG-ARCH-03: `ports/in/cancel-order-command.ts`, `ports/in/load-order-history-use-case.ts`, `adapter/out/http/http-orders.ts`.
- `Order` has a branded `OrderId` so it works with `withEntities` directly (NG-STATE-06).

Provide it where the screen lives:

```typescript
@Component({
  selector: 'app-orders-page',
  providers: [OrdersStore],
  templateUrl: './orders-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage {
  protected readonly store = inject(OrdersStore);
}
```

## Workflow

1. **Decide the scope (NG-STATE-12).** Component or route `providers: [Store]` is the default; omit `providedIn`. `{ providedIn: 'root' }` only for genuinely app-wide state (session, preferences) in `src/platform/adapter/in/ui/`. Trivial one-component state: `signalState` or plain signals.
2. **Decide on the store/use-case split (NG-STATE-02, TS-ARCH-03/08).** The store holds view state and calls **use-case contracts** injected via the tokens from `<feature>.tokens.ts`. The use case orchestrates domain + outgoing ports; the HTTP adapter does I/O and maps DTOs. If the use case doesn't exist yet, create the contract in `ports/in` first (and its token in `<feature>.tokens.ts`). Never inject `HttpClient`, generated API code, outgoing ports, adapters or another store.
3. **Type the state with an `interface`** (`withState<OrdersState>(initialState)`, NG-STATE-05). Fields `readonly`. Hold UI state and use-case results/domain values, never DTOs (NG-STATE-04).
4. **Keep rules in `domain` (NG-STATE-07).** `withComputed` may call pure domain functions (`canBeCancelled(order)`); it doesn't contain the rule itself.
5. **Compose features.** Request status (shared `withRequestStatus`), entities (`withEntities`, NG-STATE-06), selection, logging via `signalStoreFeature(...)`.
6. **Pick the right async tool (NG-STATE-08).**
   - **`async` method** awaiting a use case: the default.
   - **`rxMethod<Input>(pipe(...))`** only when RxJS operators add value (`debounceTime`, `switchMap` cancellation). Wrap the promise-returning use case in `from(...)` and pass an `AbortSignal` through.
   - **`signalMethod<Input>((value) => ...)`** for synchronous reactions to a value/signal.
   - **`resource()` in `withProps`** for a read-only reactive load whose loader calls a use case.
   - Passing a signal or computation function to `rxMethod`/`signalMethod`? Call it in an injection context or pass `{ injector }`; calling outside one is deprecated.
7. **Map errors to translation keys in one place (NG-STATE-09)** via the feature's error mapper; the store never holds translated text (NG-I18N-04); optimistic updates snapshot with `getState` and roll back (NG-STATE-10).
8. **Test first, through the public API (NG-STATE-14).** `TestBed` with the store plus `{ provide: TOKEN, useValue: mock<UseCase>() }` from `vitest-mock-extended`. Assert on signals. Cover error and rollback paths. Seed state with `patchState(unprotected(store), ...)`.

## Wrong → Right (the corrections that matter most)

### 1. Store talks to the backend directly

```typescript
// ❌ Wrong: HTTP / API service / outgoing port inside the store (violates NG-STATE-02, TS-ARCH-03).
withMethods((store, http = inject(HttpClient)) => ({
  async load(): Promise<void> {
    const dtos = await firstValueFrom(http.get<OrderDto[]>('/api/orders'));
    patchState(store, setAllEntities(dtos)); // and now DTOs are in UI state (NG-STATE-04)
  },
}));

// ✅ Right: inject the use-case contract through its token; results are domain values.
withMethods((store, loadHistory = inject(LOAD_ORDER_HISTORY)) => ({
  async load(customerId: CustomerId): Promise<void> {
    const orders = await loadHistory.loadOrderHistory(LoadOrderHistoryQuery.of({ customerId }));
    patchState(store, setAllEntities([...orders]));
  },
}));
```

### 2. Feature state provided in root

```typescript
// ❌ Wrong: survives navigation, shows stale orders on the next visit.
export const OrdersStore = signalStore({ providedIn: 'root' }, withState<OrdersState>(initialState));

// ✅ Right: no config; the page/route lists it in providers (NG-STATE-12).
export const OrdersStore = signalStore(withState<OrdersState>(initialState));
```

### 3. `type` literal state and business rules in the store

```typescript
// ❌ Wrong: type alias, mutable fields, rule inlined in the store.
type OrdersState = { filter: OrderFilter };
cancellable: computed(() => entities().filter((o) => o.status === 'open' && !o.shippedAt)),

// ✅ Right: interface + readonly (NG-STATE-05); rule is a pure domain function (NG-STATE-07).
interface OrdersState {
  readonly filter: OrderFilter;
}
cancellable: computed(() => entities().filter(canBeCancelled)),
```

### 4. `updateEntity` and `removeEntities`: function and predicate forms

```typescript
// ❌ Wrong: manual lookup, then a partial patch; leaks internals into the method body.
const current = store.entityMap()[id];
patchState(store, updateEntity({ id, changes: { selected: !current.selected } }));
const ids = store.entities().filter((o) => o.archived).map((o) => o.id);
patchState(store, removeEntities(ids));

// ✅ Right: function-form changes and predicate removal, evaluated by the updater.
patchState(store, updateEntity({ id, changes: (order) => ({ selected: !order.selected }) }));
patchState(store, removeEntities((order) => order.archived));
```

### 5. Optimistic update without rollback or mapped error

```typescript
// ❌ Wrong: no rollback path; raw error message in the UI.
patchState(store, updateEntity({ id, changes: markCancelled }));
await cancelOrder.cancelOrder(CancelOrderCommand.of({ orderId: id, reason }));

// ✅ Right: snapshot, patch, call the use case, restore + error key on failure (NG-STATE-10, NG-STATE-09).
const previous = getState(store);
patchState(store, updateEntity({ id, changes: markCancelled }));
try {
  await cancelOrder.cancelOrder(CancelOrderCommand.of({ orderId: id, reason }));
} catch (error) {
  patchState(store, { entityMap: previous.entityMap, ids: previous.ids }, setError(errors.keyFor(error)));
}
```

### 6. Request status: standalone updaters, not store-bound methods

```typescript
// ❌ Wrong: can't compose into a single patchState call.
withMethods((store) => ({ setPending() { patchState(store, { requestStatus: 'pending' }); } }))

// ✅ Right: standalone updaters returning Partial<State>, composed in one patchState call.
export function setPending(): RequestStatusState { return { requestStatus: 'pending' }; }
patchState(store, setAllEntities([...orders]), setFulfilled());
```

### 7. Custom feature with prerequisites: typed overload

```typescript
// ❌ Wrong: bare signalStoreFeature, no compile error if used without withEntities.
export function withSelectedEntity<T>() {
  return signalStoreFeature(withState({ selectedId: null }) /* ... */);
}

// ✅ Right: declare the prerequisite via { state: type<EntityState<T>>() }.
export function withSelectedEntity<T extends { id: EntityId }>() {
  return signalStoreFeature(
    { state: type<EntityState<T>>() },
    withState<SelectedEntityState>({ selectedId: null }),
    // ...
  );
}
```

Full version in `references/custom-features.md`.

### 8. Refactoring `BehaviorSubject` services: what maps to what

| Before                              | After                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `BehaviorSubject<T>` field          | state slice in `withState<FooState>(...)` (interface)                       |
| `.next(...)`                        | `patchState(store, ...)`                                                    |
| `.value`                            | signal getter `store.foo()` (or `getState(store)`)                          |
| `combineLatest` / `map` derived obs | `withComputed(...)`; business rules move to `domain` functions              |
| HTTP method on the service          | outgoing port + HTTP adapter; use case in `application`; store calls token  |
| `providedIn: 'root'` service        | store provided on the page/route unless genuinely app-wide                  |
| Component subscribes via `\| async` | reads signal: `{{ store.foo() }}`                                           |

Worked example in `references/patterns.md`.

## Output contract

When generating code:

- **Always** place the store in `features/<feature>/adapter/in/ui/<feature>-store.ts`, Angular v20+ suffixless naming: `orders-store.ts` exports `OrdersStore` (NG-STATE-01).
- **Always** inject use-case contracts via tokens imported from `<feature>.tokens.ts` (`inject(LOAD_ORDER_HISTORY)`), never from `<feature>.providers.ts` (TS-ARCH-17). Never `HttpClient`, `@angular/common/http`, generated API code, `adapter/out`, outgoing ports or another store (NG-STATE-02/03). If a token/contract is missing, create it (contract in `ports/in`, token in `<feature>.tokens.ts`).
- **Always** type state with an `interface` with `readonly` fields; hold domain values, never DTOs (NG-STATE-04/05).
- **Always** omit `providedIn` for feature state and show where it's provided (NG-STATE-12).
- **Always** use `patchState` for mutations; state stays protected.
- **Always** route errors through the feature's error mapper (NG-STATE-09), provided in `<feature>.providers.ts`, not root, and roll back optimistic updates (NG-STATE-10).
- **Always** import platform code through `src/platform/index.ts`, never deep paths (NG-ARCH-04).
- **Always** type command/query factories as `of(input: z.input<typeof Schema>)` (TS-ARCH-06).
- **Always** deliver a store test alongside (NG-STATE-14): `TestBed`, `mock<UseCase>()` from `vitest-mock-extended` provided via tokens, error/rollback paths covered.
- **Prefer** `withEntities<T>()` over a hand-rolled `T[]` for collections with stable IDs (NG-STATE-06).
- **Prefer** `async` methods; `rxMethod` only when operators add value; `signalMethod` for sync reactions (NG-STATE-08).
- **Prefer** named, typed updater functions (`setPending()`, `setError(msg)`) for repeated updates.
- Strict TypeScript, Prettier style (single quotes, 120 cols, trailing commas); code passes `@ngrx/eslint-plugin` `signalsTypeChecked` (NG-STATE-15).
- Comment only when the WHY is non-obvious.

## Pattern → reference quick map

Read the **one** reference file that matches the task. Most tasks need only one.

| Task                                                                    | Read                            |
| ----------------------------------------------------------------------- | ------------------------------- |
| Plain store, computed, methods, `withProps`, `withHooks`                | `references/api-reference.md`   |
| `rxMethod` / `signalMethod` / RxJS bridge                               | `references/api-reference.md`   |
| `withLinkedState`, `watchState`, events plugin, resource extensions     | `references/api-reference.md`   |
| Entity collection (CRUD with IDs, `selectId`, named collections)        | `references/entities.md`        |
| Custom reusable feature (`withXxx`)                                     | `references/custom-features.md` |
| Store/use-case split, scoping, optimistic, BS-refactor, errors, caching | `references/patterns.md`        |
| Tests: TestBed, `mock<UseCase>()`, `unprotected`, signal/rx methods     | `references/testing.md`         |

## Anti-patterns to flag

If the request or existing code shows any of these, point it out with the rule ID:

- **I/O in the store** (`HttpClient`, generated API client, `fetch`, outgoing port, `adapter/out` import): NG-STATE-02, TS-ARCH-03. Move it behind a use case.
- **DTOs in store state**: NG-STATE-04, TS-ARCH-05. Map in the HTTP adapter.
- **Cross-store injection or a deep import into another feature's store**: NG-STATE-02/03. Use the other feature's published API (`index.ts`, `provide<Feature>Api()`, TS-ARCH-19).
- **Tokens imported from `<feature>.providers.ts`**: TS-ARCH-17. Import them from `<feature>.tokens.ts`.
- **Deep imports into `src/platform`** (`platform/adapter/...`): NG-ARCH-04. Import from `src/platform/index.ts`.
- **Error mapper `providedIn: 'root'` inside a feature, or importing `adapter/out`**: NG-STATE-09, NG-ARCH-10.
- **Command/query factory typed `unknown`**: TS-ARCH-06. Type it `z.input<typeof Schema>`.
- **Business rules inside `withComputed`/`withMethods`**: NG-STATE-07. Extract a pure domain function.
- **Feature state in `providedIn: 'root'`**: NG-STATE-12.
- **Caching/batching backend data in a store** (e.g. a root store "so we don't refetch"): NG-STATE-11, TS-ARCH-15. Put a caching decorator on the outgoing adapter.
- **Raw `error.message` shown to users**: NG-STATE-09. Use the feature error mapper.
- **Untyped or `type`-literal state**: NG-STATE-05.
- **Hand-rolled `T[]` for entities with stable IDs**: NG-STATE-06.
- **Events plugin or classic `@ngrx/store` without an ADR**: NG-STATE-13. Propose and draft the ADR (`docs/adr/`), don't introduce it silently.
- **Tests with hand-rolled `{ fn: vi.fn() }` objects or `vi.mock` of our modules**: TS-TEST-01/02, NG-STATE-14.
- **Direct signal mutation from outside** (`store.count.set(...)`) or `protectedState: false`: expose a method; in tests use `unprotected`.
- **`rxMethod` for trivial sync logic**: use `signalMethod` or a plain method.
- **Re-syncing one slice when another changes** (an `effect` that resets `selectedId`): use `withLinkedState`.
- **Confusing `@ngrx/store` with `@ngrx/signals`**: `createReducer`/`createEffect` is classic NgRx.
- **Outdated API names**: `withEffects` (events plugin) is now `withEventHandlers`; entity `idKey` is now `selectId` via `entityConfig`; `rxMethod(...).unsubscribe()` is now `.destroy()`.
