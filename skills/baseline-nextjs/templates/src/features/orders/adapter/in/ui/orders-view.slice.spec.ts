import { describe, expect, it } from 'vitest';

import { makeStore, rootReducer } from '@/platform/index.client';

import {
  orderCancelled,
  orderSelected,
  ordersViewSlice,
  selectionCleared,
  selectOrdersView,
} from './orders-view.slice';

rootReducer.inject(ordersViewSlice);

describe('orders view slice', () => {
  it('starts with nothing selected', () => {
    expect(selectOrdersView(makeStore().getState())).toEqual({ selectedOrderId: null, cancelledOrderId: null });
  });

  it('selects an order and clears the selection', () => {
    const store = makeStore();

    store.dispatch(orderSelected('o-1'));
    expect(selectOrdersView(store.getState()).selectedOrderId).toBe('o-1');

    store.dispatch(selectionCleared());
    expect(selectOrdersView(store.getState()).selectedOrderId).toBeNull();
  });

  it('remembers the cancelled order until the next selection', () => {
    const store = makeStore();
    store.dispatch(orderSelected('o-1'));

    store.dispatch(orderCancelled('o-1'));
    expect(selectOrdersView(store.getState())).toEqual({ selectedOrderId: null, cancelledOrderId: 'o-1' });

    store.dispatch(orderSelected('o-3'));
    expect(selectOrdersView(store.getState())).toEqual({ selectedOrderId: 'o-3', cancelledOrderId: null });
  });
});
