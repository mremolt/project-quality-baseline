# @ngrx/signals — API Reference

Idiomatic, runnable examples of every primitive in the library (upstream verified them against `@ngrx/signals` 22). Read the section that matches the task; you do not need to load this whole file unless you're new to the API.

Baseline adaptations: state is typed with `interface` (NG-STATE-05), feature stores are not `providedIn: 'root'` (NG-STATE-12), and methods inject **use-case contracts via tokens** from the feature's `<feature>.tokens.ts`, never HTTP or API services (NG-STATE-02). Examples use the orders feature from `docs/baseline/08-crosscutting-concepts/ui/angular-state-management.md` (`Order`, `OrderId`, `LOAD_ORDER_HISTORY`, `LoadOrderHistoryUseCase`).

## Table of contents

- [signalStore](#signalstore)
- [withState](#withstate)
- [withComputed](#withcomputed)
- [withLinkedState](#withlinkedstate)
- [withMethods](#withmethods)
- [withProps](#withprops)
- [withHooks](#withhooks)
- [patchState](#patchstate)
- [getState / watchState](#getstate--watchstate)
- [signalState (component-local)](#signalstate-component-local)
- [rxMethod](#rxmethod)
- [signalMethod](#signalmethod)
- [Private members (`_` prefix)](#private-members-_-prefix)
- [Provider configuration](#provider-configuration)
- [Events plugin (`@ngrx/signals/events`)](#events-plugin-ngrxsignalsevents)
- [Resource extensions (`@ngrx/signals/resource`)](#resource-extensions-ngrxsignalsresource)

## signalStore

Factory that returns an injectable Angular service class assembled from the features you pass.

```typescript
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

interface CounterState {
  readonly count: number;
}

export const CounterStore = signalStore(
  // optional config first, e.g. { providedIn: 'root' } — only for app-wide state (NG-STATE-12)
  withState<CounterState>({ count: 0 }),
  withComputed(({ count }) => ({
    doubleCount: () => count() * 2,
  })),
  withMethods((store) => ({
    increment(): void {
      patchState(store, ({ count }) => ({ count: count + 1 }));
    },
  })),
);
```

Provide it on the component or route (`providers: [CounterStore]`), then inject like any other service:

```typescript
const counter = inject(CounterStore);
counter.count(); // signal getter
counter.doubleCount(); // computed getter
counter.increment(); // method
```

## withState

Declares state slices. Each top-level key becomes a `Signal<T>` on the store.

**Always type the state explicitly with an `interface`** (NG-STATE-05). This makes `patchState` errors point at the right place.

```typescript
import { signalStore, withState } from '@ngrx/signals';

interface OrderSearchState {
  readonly orders: readonly Order[];
  readonly isLoading: boolean;
  readonly filter: { readonly query: string; readonly order: 'asc' | 'desc' };
}

const initialState: OrderSearchState = {
  orders: [],
  isLoading: false,
  filter: { query: '', order: 'asc' },
};

export const OrderSearchStore = signalStore(withState<OrderSearchState>(initialState));
```

Nested object literals are exposed as deep signals: `store.filter.query()` works. Since v22 this also applies to union members, so a `user: { name: string } | null` slice becomes `DeepSignal<{ name: string }> | Signal<null>`.

`withState` also accepts a **factory**, which runs in an injection context. Use it when initial state comes from DI:

```typescript
const ORDER_SEARCH_STATE = new InjectionToken<OrderSearchState>('OrderSearchState', {
  factory: () => initialState,
});

export const OrderSearchStore = signalStore(withState(() => inject(ORDER_SEARCH_STATE)));
```

## withComputed

Creates derived signals. The factory runs in an injection context, so you can `inject(...)` here too. It receives state, props, and methods declared above it. Computed values may call **pure domain functions**; business rules themselves live in `domain` (NG-STATE-07).

```typescript
import { computed } from '@angular/core';
import { signalStore, withComputed, withState } from '@ngrx/signals';

export const OrderSearchStore = signalStore(
  withState<OrderSearchState>(initialState),
  withComputed(({ orders, filter }) => ({
    ordersCount: computed(() => orders().length),
    sortedOrders: computed(() => {
      const direction = filter.order() === 'asc' ? 1 : -1;
      return [...orders()].sort((a, b) => direction * compareOrders(a, b)); // domain function; toSorted needs lib es2023
    }),
    cancellable: computed(() => orders().filter(canBeCancelled)), // domain rule
  })),
);
```

A plain computation function (`ordersCount: () => orders().length`) is shorthand for `computed(...)`. Computed values are memoized and only recompute when the underlying signals change.

## withLinkedState

State that **resets when its source changes but stays writable** (Angular's `linkedSignal`, as store state). Use it instead of an `effect` or a method that re-syncs one slice when another changes. Linked slices are regular state: deep signals, updatable via `patchState`.

```typescript
import { linkedSignal } from '@angular/core';
import { patchState, signalStore, withLinkedState, withMethods, withState } from '@ngrx/signals';

interface Option {
  readonly id: number;
  readonly label: string;
}

interface OptionsState {
  readonly options: readonly Option[];
}

export const OptionsStore = signalStore(
  withState<OptionsState>({ options: [] }),
  withLinkedState(({ options }) => ({
    // Computation function: resets to the first option whenever options change.
    selectedOption: () => options()[0] ?? null,
    // linkedSignal: keeps the previous selection if it still exists.
    stickyOption: linkedSignal<readonly Option[], Option | null>({
      source: options,
      computation: (next, prev) => next.find((o) => o.id === prev?.value?.id) ?? next[0] ?? null,
    }),
  })),
  withMethods((store) => ({
    select(selectedOption: Option): void {
      patchState(store, { selectedOption });
    },
  })),
);
```

## withMethods

Adds methods to the store. The factory receives the store instance (with state, computed, and any earlier props/methods) and runs in an injection context. Methods turn user intent into **use-case calls** (NG-STATE-02); the use-case contract comes in through its token from the feature's `<feature>.tokens.ts`.

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

import { LOAD_ORDER_HISTORY } from '../../../orders.tokens';
import { LoadOrderHistoryQuery } from '../../../ports/in/load-order-history-query';

export const OrderSearchStore = signalStore(
  withState<OrderSearchState>(initialState),
  withMethods((store, loadHistory = inject(LOAD_ORDER_HISTORY)) => ({
    updateQuery(query: string): void {
      patchState(store, (state) => ({
        filter: { ...state.filter, query },
      }));
    },
    async loadOrders(customerId: CustomerId): Promise<void> {
      patchState(store, { isLoading: true });
      const orders = await loadHistory.loadOrderHistory(LoadOrderHistoryQuery.of({ customerId }));
      patchState(store, { orders, isLoading: false });
    },
  })),
);
```

Inject dependencies as default parameters: this keeps the method body free of `inject()` calls and lets tests override them with `{ provide: LOAD_ORDER_HISTORY, useValue: mock<LoadOrderHistoryUseCase>() }`. Error handling is omitted here; see `patterns.md` (NG-STATE-09).

## withProps

Attaches non-reactive properties to the store. Useful for grouping injected dependencies that other features will use, for exposing derived non-signal values (e.g. `toObservable(isLoading)`), or for a `resource()` whose loader calls a use case (NG-STATE-08).

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';

export const OrderSearchStore = signalStore(
  withState<OrderSearchState>(initialState),
  withProps(() => ({
    _loadHistory: inject(LOAD_ORDER_HISTORY),
    _logger: inject(Logger),
  })),
  withMethods(({ _loadHistory, _logger, ...store }) => ({
    async loadOrders(customerId: CustomerId): Promise<void> {
      _logger.debug('Loading orders...');
      patchState(store, { isLoading: true });
      const orders = await _loadHistory.loadOrderHistory(LoadOrderHistoryQuery.of({ customerId }));
      patchState(store, { orders, isLoading: false });
    },
  })),
);
```

Prefix props with `_` if they should not be visible to store consumers.

Read-only reactive load with `resource()`:

```typescript
import { inject, resource } from '@angular/core';
import { signalStore, withComputed, withProps, withState } from '@ngrx/signals';

interface OrderHistoryState {
  readonly customerId: CustomerId | null;
}

export const OrderHistoryStore = signalStore(
  withState<OrderHistoryState>({ customerId: null }),
  withProps(({ customerId }, loadHistory = inject(LOAD_ORDER_HISTORY)) => ({
    _history: resource({
      params: () => {
        const id = customerId();
        return id === null ? undefined : { customerId: id }; // undefined = don't load
      },
      loader: ({ params, abortSignal }) =>
        loadHistory.loadOrderHistory(LoadOrderHistoryQuery.of(params), abortSignal),
    }),
  })),
  withComputed(({ _history }) => ({
    orders: () => (_history.hasValue() ? _history.value() : []), // value() throws in error state
    isLoading: () => _history.isLoading(),
  })),
);
```

## withHooks

Lifecycle hooks called when the store is created/destroyed.

```typescript
import { inject } from '@angular/core';
import { signalStore, withHooks, withProps } from '@ngrx/signals';

export const OrdersStore = signalStore(
  withProps(() => ({ _logger: inject(Logger) })),
  withHooks({
    onInit({ _logger }) {
      _logger.debug('OrdersStore initialized');
    },
    onDestroy({ _logger }) {
      _logger.debug('OrdersStore destroyed');
    },
  }),
);
```

The hook callbacks receive the fully-assembled store, so you can call methods (e.g. trigger an initial load). `withHooks` also accepts a factory `(store) => ({ onInit, onDestroy })` that runs in an injection context, for hooks that need `inject()`.

## patchState

Immutable state update. Three forms:

```typescript
import { patchState } from '@ngrx/signals';

// 1. Partial state object — shallow-merge.
patchState(store, { isLoading: true });

// 2. Updater function — receives current state, returns partial.
patchState(store, (state) => ({ count: state.count + 1 }));

// 3. Spread of named updaters (composable).
patchState(store, setPending(), setQuery('angular'));
```

Custom updaters are just functions that return one of forms 1 or 2:

```typescript
function setPending(): Partial<RequestStatusState> {
  return { requestStatus: 'pending' };
}

function setError(message: string): Partial<RequestStatusState> {
  return { requestStatus: { error: message } };
}
```

Custom updaters are the right tool when the same state shape is patched in many places. Define them next to the feature that owns the state.

State is **protected** by default: `patchState(store, ...)` from outside the store (component, other service) is a compile error. Expose a method instead.

## getState / watchState

`getState` is a snapshot read of the entire state object — useful for capturing a "before" copy for rollback (NG-STATE-10).

```typescript
import { getState, patchState } from '@ngrx/signals';

const previous = getState(store);
patchState(store, updateEntity({ id, changes: markCancelled }));
try {
  await cancelOrder.cancelOrder(CancelOrderCommand.of({ orderId: id, reason }));
} catch (error) {
  patchState(store, { entityMap: previous.entityMap, ids: previous.ids }, setError(errors.keyFor(error)));
}
```

`watchState` runs a watcher **synchronously on every state change** (unlike `effect`, which batches). Call it in an injection context (e.g. `onInit`); it is cleaned up with the store.

```typescript
withHooks({
  onInit(store) {
    watchState(store, (state) => console.log('[Orders]', state));
  },
});
```

## signalState (component-local)

For pure component-local state where a full store is overkill, use `signalState` (NG-STATE-12). It is a smaller version of `withState` you can use directly inside a component.

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { patchState, signalState } from '@ngrx/signals';

interface CounterState {
  readonly count: number;
}

@Component({
  selector: 'app-counter',
  template: `
    <p>Count: {{ state.count() }}</p>
    <button type="button" (click)="increment()">+</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Counter {
  protected readonly state = signalState<CounterState>({ count: 0 });

  protected increment(): void {
    patchState(this.state, (s) => ({ count: s.count + 1 }));
  }
}
```

If you reach for a Signal Store for state used in exactly one component and never re-injected, prefer `signalState` (or even a plain `signal()`).

## rxMethod

Bridges RxJS into the store. Use only when RxJS operators add value — `debounceTime`, `switchMap` cancellation, retry (NG-STATE-08). The argument can be:

- A static value (one-shot emission),
- An `Observable<T>` (subscribed),
- A `Signal<T>` or a computation function `() => T` (re-emits on changes).

Use cases return `Promise` (TS-D1) and accept an optional `AbortSignal`. Bridge them with a small helper so `switchMap` really cancels the in-flight call:

```typescript
// src/platform/adapter/in/ui/state/from-abortable.ts
import { Observable } from 'rxjs';

export function fromAbortable<T>(run: (signal: AbortSignal) => Promise<T>): Observable<T> {
  return new Observable<T>((subscriber) => {
    const controller = new AbortController();
    run(controller.signal).then(
      (value) => {
        subscriber.next(value);
        subscriber.complete();
      },
      (error: unknown) => {
        subscriber.error(error);
      },
    );
    return () => {
      controller.abort();
    };
  });
}
```

```typescript
import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { debounceTime, distinctUntilChanged, pipe, switchMap, tap } from 'rxjs';

export const OrderSearchStore = signalStore(
  withState<OrderSearchState>(initialState),
  withMethods((store, searchOrders = inject(SEARCH_ORDERS), errors = inject(OrdersErrorKeys)) => ({
    // rxMethod: debounce + switchMap cancellation are the point here (NG-STATE-08).
    searchByQuery: rxMethod<string>(
      pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => {
          patchState(store, { isLoading: true });
        }),
        switchMap((query) =>
          fromAbortable((signal) => searchOrders.searchOrders(SearchOrdersQuery.of({ query }), signal)).pipe(
            tapResponse({
              next: (orders) => {
                patchState(store, { orders, isLoading: false });
              },
              error: (error: unknown) => {
                patchState(store, { isLoading: false }, setError(errors.keyFor(error)));
              },
            }),
          ),
        ),
      ),
    ),
  })),
);
```

Use `tapResponse` from `@ngrx/operators` rather than a bare `subscribe` — it handles the inner error so the outer stream keeps running.

**Injection context:** passing a signal, computation function, or observable **outside** an injection context is deprecated (warns since v21.1, will throw). Call it in a constructor/field initializer, or pass the caller's injector: `store.searchByQuery(query, { injector })`. The subscription then lives as long as that injector.

## signalMethod

Pure-signal alternative to `rxMethod`. Use when input is a value, signal, or computation function and the body is synchronous (or just needs an `effect`-like reaction).

```typescript
import { patchState, signalMethod, signalStore, withMethods, withState } from '@ngrx/signals';

export const CounterStore = signalStore(
  withState<CounterState>({ count: 0 }),
  withMethods((store) => ({
    incrementBy: signalMethod<number>((step) => {
      patchState(store, ({ count }) => ({ count: count + step }));
    }),
  })),
);

// In a component:
store.incrementBy(5); // one-shot
store.incrementBy(this.step); // re-runs when the signal changes
store.incrementBy(() => this.a() + this.b()); // computation function
```

The same injection-context rule as `rxMethod` applies to signal / computation-function inputs (`{ injector }` config otherwise).

## Private members (`_` prefix)

Prefix any state slice, computed signal, prop, or method with `_` to make it private to the store. Public callers cannot access it; features declared **after** it in the same store can.

```typescript
interface AuditedCounterState {
  readonly count: number;
  readonly _audit: readonly string[];
}

export const CounterStore = signalStore(
  withState<AuditedCounterState>({ count: 0, _audit: [] }),
  withMethods((store) => ({
    _record(event: string): void {
      patchState(store, ({ _audit }) => ({ _audit: [..._audit, event] }));
    },
  })),
  // A method can't call a sibling from the same withMethods factory — use a second one.
  withMethods((store) => ({
    increment(): void {
      store._record('increment');
      patchState(store, ({ count }) => ({ count: count + 1 }));
    },
  })),
);
```

Use private members to enforce a clean public API. From outside, only `count` and `increment` are visible.

## Provider configuration

The first argument to `signalStore` may be a config object:

```typescript
signalStore(
  { providedIn: 'root' },
  withState<SessionState>(initialSessionState),
);
```

Common shapes:

- **Omit the config (our default, NG-STATE-12)** — the store is not provided anywhere; the component or route lists it in `providers: [Store]`. It is created and destroyed with its host.
- `{ providedIn: 'root' }` — singleton across the app. Only for genuinely app-wide state (session, user preferences), placed in `src/platform/adapter/in/ui/`.
- `{ providedIn: 'platform' }` — shared across multiple Angular apps on the same page (micro-frontends). Rare.
- `{ protectedState: false }` — allows `patchState` from outside the store. Don't; in tests use `unprotected(store)` from `@ngrx/signals/testing` instead.

Component-scoped example:

```typescript
@Component({
  selector: 'app-orders-page',
  providers: [OrdersStore], // a fresh store per OrdersPage instance
  templateUrl: './orders-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage {
  protected readonly store = inject(OrdersStore);
}
```

Route-scoped example (shared by all components under the route, destroyed when the route's injector goes away):

```typescript
export const ordersRoutes: Routes = [
  { path: '', component: OrdersPage, providers: [...ordersProviders, OrdersStore] },
];
```

## Events plugin (`@ngrx/signals/events`)

**Requires an ADR in our projects (NG-STATE-13).** Signal Store with methods covers our use cases; propose the events plugin only with a concrete reason and draft the ADR in `docs/adr/`. If accepted, the same placement rules apply: event handlers call use cases, not HTTP.

Opt-in Flux-style layer (stable since v21). Upstream reaches for it when **several stores must react to the same thing** (logout clears cart + profile) or you want decoupled, traceable flows. For a single store, plain methods are simpler.

```typescript
import { inject } from '@angular/core';
import { mapResponse } from '@ngrx/operators';
import { signalStore, type, withState } from '@ngrx/signals';
import { Events, eventGroup, injectDispatch, on, withEventHandlers, withReducer } from '@ngrx/signals/events';
import { from, switchMap } from 'rxjs';

export const orderSearchEvents = eventGroup({
  source: 'Order Search Page',
  events: { opened: type<void>(), queryChanged: type<string>() },
});
export const orderSearchResultEvents = eventGroup({
  source: 'Search Orders Use Case',
  events: { loadedSuccess: type<readonly Order[]>(), loadedFailure: type<string>() },
});

export const OrderSearchStore = signalStore(
  withState<OrderSearchState>({ query: '', orders: [], isLoading: false }),
  withReducer(
    on(orderSearchEvents.queryChanged, ({ payload: query }) => ({ query, isLoading: true })),
    on(orderSearchResultEvents.loadedSuccess, ({ payload: orders }) => ({ orders, isLoading: false })),
    on(orderSearchResultEvents.loadedFailure, () => ({ isLoading: false })),
  ),
  withEventHandlers(
    (store, events = inject(Events), searchOrders = inject(SEARCH_ORDERS), errors = inject(OrdersErrorKeys)) => ({
      loadOrders$: events.on(orderSearchEvents.opened, orderSearchEvents.queryChanged).pipe(
        switchMap(() =>
          from(searchOrders.searchOrders(SearchOrdersQuery.of({ query: store.query() }))).pipe(
            mapResponse({
              next: (orders) => orderSearchResultEvents.loadedSuccess(orders),
              error: (error: unknown) => orderSearchResultEvents.loadedFailure(errors.keyFor(error)),
            }),
          ),
        ),
      ),
    }),
  ),
);

// Component: const dispatch = injectDispatch(orderSearchEvents); dispatch.queryChanged('ngrx');
```

- `withEffects` was **renamed to `withEventHandlers`** in v21 (`ng update` migrates it).
- Events returned from a handler stream are dispatched automatically.
- Dispatch can be scoped: `dispatch({ scope: 'parent' }).opened()` / `'global'`; provide a local scope with `provideDispatcher()`.

## Resource extensions (`@ngrx/signals/resource`)

**Experimental (v22).** Wraps an Angular `resource` to change what `value()` returns while loading or on error, keeping the resource type.

Our UI adapters don't use `httpResource` (it puts HTTP in the UI, TS-ARCH-04); wrap a `resource()` whose loader calls a use case instead:

```typescript
import { resource } from '@angular/core';
import { extendResource, withPreviousValueOnLoading, withValueOnError } from '@ngrx/signals/resource';

readonly ordersResource = extendResource(
  resource({
    params: () => ({ page: this.page() }),
    loader: ({ params, abortSignal }) => this.listOrders.listOrders(ListOrdersQuery.of(params), abortSignal),
  }),
  withPreviousValueOnLoading(), // no flicker while paginating
  withValueOnError(undefined), // value() doesn't throw on error
);
```

Also: `withValueOnLoading(v)`, `withPreviousValueOnError()`, and `provideResourceExtensions(...)` to set defaults per app/route/component. Inside a store, create the resource in `withProps` (prefix `_` to keep it private) and derive signals in `withComputed`.
