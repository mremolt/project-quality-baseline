# @ngrx/signals — Testing

Store tests are **adapter integration tests** (NG-STATE-14, TEST-ARCH-03): `TestBed` provides the store plus its use-case tokens, each bound to `mock<UseCase>()` from `vitest-mock-extended` (TS-TEST-01, London style per `docs/baseline/08-crosscutting-concepts/testing/tdd.md`). Assert through the store's public signals. Cover the error and rollback paths. Write the test first (TEST-TDD-01/02).

## Guiding principles

- **Test the public surface, not the wiring.** Assert on signal values and on the outcome of methods. Don't reach into private slices, don't replace methods, don't introspect `signalStore` internals.
- **Mock only contracts we own** (TEST-TDD-07): use-case interfaces from `ports/in`, provided through their tokens. Never mock `HttpClient`, the store itself, domain values or `patchState`.
- **Stub queries, verify commands** (TS-TEST-03, TEST-TDD-09): stub `loadOrderHistory` with `calledWith(...).mockResolvedValue(...)` and assert on the store's signals; verify `cancelOrder` was called only when the call *is* the behavior.
- **No `vi.mock` of our own modules** (TS-TEST-02). Dependencies come in through DI.
- **Use real domain values** built by test-data builders (`anOpenOrder('o-1')`), not mocks of them.

## Basic store test (no dependencies)

```typescript
import { TestBed } from '@angular/core/testing';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

interface CounterState {
  readonly count: number;
}

const CounterStore = signalStore(
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

describe('CounterStore', () => {
  beforeEach(() => {
    // Not providedIn root (NG-STATE-12), so the test module provides it.
    TestBed.configureTestingModule({ providers: [CounterStore] });
  });

  it('exposes initial state and derived doubleCount', () => {
    const store = TestBed.inject(CounterStore);

    expect(store.count()).toBe(0);
    expect(store.doubleCount()).toBe(0);
  });

  it('updates count and doubleCount on increment', () => {
    const store = TestBed.inject(CounterStore);

    store.increment();

    expect(store.count()).toBe(1);
    expect(store.doubleCount()).toBe(2);
  });
});
```

## Mocking use cases via tokens

The canonical shape from `docs/baseline/08-crosscutting-concepts/ui/angular-state-management.md`:

```typescript
import { TestBed } from '@angular/core/testing';
import { mock, mockReset } from 'vitest-mock-extended';

import { anOpenOrder, aCustomerId } from '../../../domain/order.test-data';
import { OrderAlreadyShipped } from '../../../domain/order-errors';
import { orderId } from '../../../domain/order';
import { REPORT_ERROR, type ReportErrorUseCase } from '../../../../../platform';
import { CANCEL_ORDER, LOAD_ORDER_HISTORY } from '../../../orders.tokens';
import type { CancelOrderUseCase } from '../../../ports/in/cancel-order-use-case';
import type { LoadOrderHistoryUseCase } from '../../../ports/in/load-order-history-use-case';
import { OrdersErrorKeys } from './orders-error-keys';
import { OrdersStore } from './orders-store';

describe('OrdersStore', () => {
  const loadHistory = mock<LoadOrderHistoryUseCase>();
  const cancelOrder = mock<CancelOrderUseCase>();
  const reportError = mock<ReportErrorUseCase>();

  beforeEach(() => {
    mockReset(loadHistory);
    mockReset(cancelOrder);
    mockReset(reportError);
    TestBed.configureTestingModule({
      providers: [
        OrdersStore,
        OrdersErrorKeys,
        { provide: LOAD_ORDER_HISTORY, useValue: loadHistory },
        { provide: CANCEL_ORDER, useValue: cancelOrder },
        { provide: REPORT_ERROR, useValue: reportError },
      ],
    });
  });

  it('shows the loaded order history', async () => {
    const store = TestBed.inject(OrdersStore);
    loadHistory.loadOrderHistory.mockResolvedValue([anOpenOrder('o-1')]);

    await store.load(aCustomerId());

    expect(store.isFulfilled()).toBe(true);
    expect(store.entities().map((o) => o.id)).toEqual([orderId('o-1')]);
  });

  it('sets the generic error key when loading fails', async () => {
    const store = TestBed.inject(OrdersStore);
    loadHistory.loadOrderHistory.mockRejectedValue(new Error('network down'));

    await store.load(aCustomerId());

    expect(store.error()).toBe('common.errors.unexpected');
    expect(store.entities()).toEqual([]);
  });

  it('rolls back a cancellation the backend rejected', async () => {
    const store = TestBed.inject(OrdersStore);
    loadHistory.loadOrderHistory.mockResolvedValue([anOpenOrder('o-1')]);
    cancelOrder.cancelOrder.mockRejectedValue(new OrderAlreadyShipped('o-1'));
    await store.load(aCustomerId());

    await store.cancel(orderId('o-1'), 'Ordered twice');

    expect(store.entityMap()[orderId('o-1')]?.status).toBe('open');
    expect(store.error()).toBe('orders.errors.alreadyShipped');
    expect(store.cancelling()).toBeNull();
  });
});
```

Notes:

- `OrdersErrorKeys` is not auto-provided (it is listed in `orders.providers.ts`, NG-STATE-09), so the test lists it and the real one runs. That is intended: the error mapping is part of the UI adapter's behavior. Its only dependency, the platform's `REPORT_ERROR` use case, is a `mock<ReportErrorUseCase>()`; verify `reportError.report` when a test feeds an unexpected error.
- If the query arguments matter, stub with `calledWith` and a typed `matches` predicate: `loadHistory.loadOrderHistory.calledWith(matches((q: LoadOrderHistoryQuery) => q.customerId === customerId)).mockResolvedValue([...])`. `calledWith` compares a non-matcher argument with `===`, so a query object built in the test never matches the one the store builds (TS-TEST-03).
- `mock()` instances are shared across tests here; `mockReset` in `beforeEach` keeps tests independent. Creating them inside `beforeEach` works too.

## Seeding protected state with `unprotected`

State is protected, so `patchState(store, ...)` in a test is a compile error. To arrange a scenario (e.g. test a computed) without calling a chain of methods, wrap the store with `unprotected` from `@ngrx/signals/testing`:

```typescript
import { patchState } from '@ngrx/signals';
import { setAllEntities } from '@ngrx/signals/entities';
import { unprotected } from '@ngrx/signals/testing';

it('lists only open orders when filtered to open', () => {
  const store = TestBed.inject(OrdersStore);

  patchState(unprotected(store), setAllEntities([anOpenOrder('o-1'), aShippedOrder('o-2')]), { filter: 'open' });

  expect(store.visibleOrders().map((o) => o.id)).toEqual([orderId('o-1')]);
});
```

Use it for **arranging** state only; still assert through public signals. Don't set `protectedState: false` on the store just to make tests easier.

## Testing `signalMethod`

For static values, just call. For signal-driven calls, call inside `TestBed.runInInjectionContext` (calling with a signal outside an injection context is deprecated) and flush with `expect.poll` or `TestBed.tick()`.

```typescript
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { patchState, signalMethod, signalStore, withMethods, withState } from '@ngrx/signals';

const CounterStore = signalStore(
  withState<CounterState>({ count: 0 }),
  withMethods((store) => ({
    increment: signalMethod<number>((step) => {
      patchState(store, ({ count }) => ({ count: count + step }));
    }),
  })),
);

describe('CounterStore.increment (signalMethod)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CounterStore] });
  });

  it('increments by a static step synchronously', () => {
    const store = TestBed.inject(CounterStore);

    store.increment(1);
    expect(store.count()).toBe(1);
    store.increment(2);
    expect(store.count()).toBe(3);
  });

  it('increments by a signal step after tick', async () => {
    const store = TestBed.inject(CounterStore);
    const step = signal(2);

    TestBed.runInInjectionContext(() => {
      store.increment(step);
    });
    expect(store.count()).toBe(0);

    await expect.poll(() => store.count()).toBe(2);

    step.set(3);
    TestBed.tick();
    expect(store.count()).toBe(5);
  });
});
```

A `signalMethod` that triggers a use-case load (`loadFor(customerId)`, see `patterns.md`) is tested the same way, with the use case mocked: set the signal, `TestBed.tick()`, then `await expect.poll(() => store.isFulfilled()).toBe(true)`.

## Testing `rxMethod`

Trigger it by calling, advance fake timers past the debounce, and wait for the result with `vi.waitFor` (it advances fake timers itself; `expect.poll` works with real timers). The mocked use case returns a `Promise`, like the real contract (TS-D1).

```typescript
import { TestBed } from '@angular/core/testing';
import { mock } from 'vitest-mock-extended';

describe('OrderSearchStore.searchByQuery', () => {
  const searchOrders = mock<SearchOrdersUseCase>();

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [OrderSearchStore, { provide: SEARCH_ORDERS, useValue: searchOrders }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces keystrokes and shows the results of the last query', async () => {
    const store = TestBed.inject(OrderSearchStore);
    searchOrders.searchOrders.mockResolvedValue([anOpenOrder('o-1')]);

    store.searchByQuery('a');
    store.searchByQuery('ab');
    await vi.advanceTimersByTimeAsync(300);

    // vi.waitFor also advances fake timers and flushes the use-case promise.
    await vi.waitFor(() => {
      expect(store.orders().map((o) => o.id)).toEqual([orderId('o-1')]);
    });
    expect(searchOrders.searchOrders).toHaveBeenCalledTimes(1);
    expect(store.isLoading()).toBe(false);
  });

  it('keeps the stream alive after a failed search', async () => {
    const store = TestBed.inject(OrderSearchStore);
    searchOrders.searchOrders.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([anOpenOrder('o-2')]);

    store.searchByQuery('x');
    await vi.advanceTimersByTimeAsync(300);
    store.searchByQuery('xy');
    await vi.advanceTimersByTimeAsync(300);

    await vi.waitFor(() => {
      expect(store.orders().map((o) => o.id)).toEqual([orderId('o-2')]);
    });
  });
});
```

Verifying `toHaveBeenCalledTimes(1)` is fine here: debouncing *is* the behavior under test.

## Testing custom features

Wrap the feature in a tiny throwaway `signalStore` and assert on it. Features are best tested in isolation; once they pass here, they need no re-testing in every host store.

```typescript
import { TestBed } from '@angular/core/testing';
import { patchState, signalStore, type } from '@ngrx/signals';
import { setAllEntities, withEntities } from '@ngrx/signals/entities';
import { unprotected } from '@ngrx/signals/testing';

import { withSelectedEntity } from './with-selected-entity';

interface Item {
  readonly id: string;
  readonly name: string;
}

describe('withSelectedEntity', () => {
  const TestStore = signalStore(withEntities({ entity: type<Item>() }), withSelectedEntity<Item>());

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TestStore] });
  });

  it('selects an entity and clears the selection', () => {
    const store = TestBed.inject(TestStore);
    patchState(unprotected(store), setAllEntities<Item>([{ id: 'a', name: 'A' }]));

    store.select('a');
    expect(store.selectedEntity()).toEqual({ id: 'a', name: 'A' });

    store.clearSelection();
    expect(store.selectedEntity()).toBeNull();
  });
});
```

Features without prerequisites (e.g. `withRequestStatus`) are wrapped the same way: `signalStore(withRequestStatus())`, then assert the computed flags after `patchState(unprotected(store), setPending())`.

## Things to avoid in tests

- Hand-rolled `{ loadOrderHistory: vi.fn() }` objects for contracts — use `mock<LoadOrderHistoryUseCase>()` (TS-TEST-01).
- `vi.mock('../../../application/...')` — provide tokens instead (TS-TEST-02).
- Providing a real use-case implementation or HTTP adapter in a store test — that's a different test type.
- `(store as any)._privateSlice()` — if you need to assert private state, the API is wrong, not the test.
- `protectedState: false` in production code just so tests can patch — use `unprotected(store)`.
- Spying on internal `effect()` calls.
- Relying on call order across `withComputed` slices — an implementation detail of the feature, not the contract.
- Mocking `patchState`. It's a free function from `@ngrx/signals`; let it do its job.
