import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { createAppStore, rootReducer } from '../../../../../platform';
import { TechnicalError } from '../../../../../platform/domain';
import { OrderAlreadyShipped } from '../../../domain/order-errors';
import { CancelOrderCommand, type CancelOrderUseCase } from '../../../ports/in/cancel-order.use-case';
import { cancelOrder, cancelRequested, ordersSlice, selectOrdersView } from './orders.slice';

rootReducer.inject(ordersSlice);

const command = CancelOrderCommand.of({ orderId: 'o-1', reason: 'Ordered twice' });

function setUp() {
  const store = createAppStore();
  const useCase = mock<CancelOrderUseCase>();
  store.dispatch(cancelRequested('o-1'));
  return { store, useCase };
}

describe('orders slice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts without a dialog before anything happened', () => {
    expect(selectOrdersView(createAppStore().getState())).toEqual({
      cancelOrderId: null,
      cancelStatus: 'idle',
      cancelError: null,
    });
  });

  it('closes the dialog after a successful cancel', async () => {
    const { store, useCase } = setUp();
    useCase.cancel.mockResolvedValue({
      id: 'o-1',
      number: 'A-1001',
      status: 'CANCELLED',
      total: { amount: '1.00', currency: 'EUR' },
      createdAt: new Date(),
    });

    await store.dispatch(cancelOrder({ useCase, command }));

    expect(useCase.cancel).toHaveBeenCalledWith(command, expect.any(AbortSignal));
    expect(selectOrdersView(store.getState())).toMatchObject({ cancelOrderId: null, cancelStatus: 'succeeded' });
  });

  it.each([
    [new OrderAlreadyShipped('o-1'), 'alreadyShipped'],
    [new TechnicalError('server'), 'technical'],
  ])('keeps the dialog open with the mapped error key for %s', async (error, key) => {
    const { store, useCase } = setUp();
    useCase.cancel.mockRejectedValue(error);

    await store.dispatch(cancelOrder({ useCase, command }));

    expect(selectOrdersView(store.getState())).toEqual({
      cancelOrderId: 'o-1',
      cancelStatus: 'failed',
      cancelError: key,
    });
  });

  it('passes the serializability check although the thunk argument holds the use case (meta.arg is ignored)', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const { store, useCase } = setUp();
    useCase.cancel.mockRejectedValue(new OrderAlreadyShipped('o-1'));

    await store.dispatch(cancelOrder({ useCase, command }));

    expect(consoleError).not.toHaveBeenCalled();
  });
});
