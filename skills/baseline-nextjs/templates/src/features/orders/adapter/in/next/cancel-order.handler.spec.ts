import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { TechnicalError, UnauthenticatedError } from '@/platform';

import { OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';
import { CancelOrderCommand, type CancelOrderUseCase } from '../../../ports/in/cancel-order.use-case';
import { handleCancelOrder } from './cancel-order.handler';

const input = { orderId: 'o-1', reason: 'changed my mind' };

function setup(signedIn = true) {
  const cancelOrder = mock<CancelOrderUseCase>();
  const deps = {
    currentCaller: () => Promise.resolve(signedIn ? { subject: 'user-1' } : undefined),
    cancelOrder,
  };
  return { cancelOrder, deps };
}

describe('handleCancelOrder (NEXT-TEST-06)', () => {
  it('cancels through the use case with the parsed command', async () => {
    const { cancelOrder, deps } = setup();
    cancelOrder.cancelOrder.mockResolvedValue();

    await expect(handleCancelOrder(input, deps)).resolves.toEqual({ ok: true });
    expect(cancelOrder.cancelOrder).toHaveBeenCalledExactlyOnceWith(CancelOrderCommand.of(input));
  });

  it('answers UNAUTHENTICATED without a session and calls nothing', async () => {
    const { cancelOrder, deps } = setup(false);

    await expect(handleCancelOrder(input, deps)).resolves.toEqual({ ok: false, errorCode: 'UNAUTHENTICATED' });
    expect(cancelOrder.cancelOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown key', { ...input, ownerId: 'someone-else' }],
    ['a wrong type', { ...input, reason: 42 }],
    ['an id outside the spec format', { ...input, orderId: '..' }],
    ['no object', 'o-1'],
  ])('answers INVALID_INPUT for %s and calls nothing', async (_, bad) => {
    const { cancelOrder, deps } = setup();

    await expect(handleCancelOrder(bad, deps)).resolves.toEqual({ ok: false, errorCode: 'INVALID_INPUT' });
    expect(cancelOrder.cancelOrder).not.toHaveBeenCalled();
  });

  it.each([
    [new OrderNotFound('o-1'), 'ORDER_NOT_FOUND'],
    [new OrderAlreadyShipped('o-1'), 'ORDER_ALREADY_SHIPPED'],
    [new UnauthenticatedError('expired'), 'UNAUTHENTICATED'],
    [new TechnicalError('down'), 'TECHNICAL'],
  ])('maps %s to its code', async (error, errorCode) => {
    const { cancelOrder, deps } = setup();
    cancelOrder.cancelOrder.mockRejectedValue(error);

    await expect(handleCancelOrder(input, deps)).resolves.toEqual({ ok: false, errorCode });
  });

  it('rethrows a programming error', async () => {
    const { cancelOrder, deps } = setup();
    cancelOrder.cancelOrder.mockRejectedValue(new TypeError('bug'));

    await expect(handleCancelOrder(input, deps)).rejects.toThrow(TypeError);
  });
});
