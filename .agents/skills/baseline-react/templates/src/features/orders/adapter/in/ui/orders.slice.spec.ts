import { describe, expect, it } from 'vitest';

import { createAppStore, rootReducer } from '../../../../../platform';
import { cancelClosed, cancelRequested, ordersSlice, selectOrdersView } from './orders.slice';

rootReducer.inject(ordersSlice);

describe('orders slice', () => {
  it('starts without a dialog before anything happened', () => {
    expect(selectOrdersView(createAppStore().getState())).toEqual({ cancelOrderId: null });
  });

  it('remembers which order the cancel dialog is for', () => {
    const store = createAppStore();

    store.dispatch(cancelRequested('o-1'));

    expect(selectOrdersView(store.getState())).toEqual({ cancelOrderId: 'o-1' });
  });

  it('forgets the order when the dialog closes', () => {
    const store = createAppStore();
    store.dispatch(cancelRequested('o-1'));

    store.dispatch(cancelClosed());

    expect(selectOrdersView(store.getState())).toEqual({ cancelOrderId: null });
  });
});
