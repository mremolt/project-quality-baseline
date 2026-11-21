import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { makeStore, rootReducer } from '@/platform/index.client';

import { OrderAlreadyShipped } from '../../../domain/order-errors';
import { CancelOrderCommand, type CancelOrderUseCase } from '../../../ports/in/cancel-order.use-case';
import { cancelOrder, orderSelected, ordersViewSlice, selectOrdersView } from './orders-view.slice';

rootReducer.inject(ordersViewSlice);

describe('orders view slice', () => {
  const useCase = mock<CancelOrderUseCase>();
  const command = CancelOrderCommand.of({ orderId: 'o-1', reason: 'changed my mind' });
  const consoleError = vi.spyOn(console, 'error');

  afterEach(() => {
    expect(consoleError).not.toHaveBeenCalled(); // no serializability or immutability warnings from RTK's checks
  });

  it('selects an order and cancels it through the use case', async () => {
    const store = makeStore();
    useCase.cancelOrder.mockResolvedValue();
    store.dispatch(orderSelected('o-1'));

    await store.dispatch(cancelOrder({ useCase, command }));

    expect(useCase.cancelOrder).toHaveBeenCalledExactlyOnceWith(command);
    expect(selectOrdersView(store.getState())).toEqual({
      selectedOrderId: null,
      cancelStatus: 'succeeded',
      errorKey: null,
    });
  });

  it('maps a domain error to its translation key', async () => {
    const store = makeStore();
    useCase.cancelOrder.mockRejectedValue(new OrderAlreadyShipped('o-1'));

    await store.dispatch(cancelOrder({ useCase, command }));

    expect(selectOrdersView(store.getState())).toMatchObject({
      cancelStatus: 'failed',
      errorKey: 'errors.alreadyShipped',
    });
  });
});
