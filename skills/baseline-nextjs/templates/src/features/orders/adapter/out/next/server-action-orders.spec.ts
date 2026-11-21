import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { TechnicalError, UnauthenticatedError } from '@/platform';
import type { ReportErrorUseCase } from '@/platform/index.client';

import { OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';
import type { CancelOrderActionResult } from '../../in/next/cancel-order.handler';
import { ServerActionOrders } from './server-action-orders';

function setUp(answer: () => Promise<CancelOrderActionResult>) {
  const action = vi.fn(answer);
  const reportError = mock<ReportErrorUseCase>();
  return { action, reportError, adapter: new ServerActionOrders(action, reportError) };
}

const failed = (errorCode: Exclude<CancelOrderActionResult, { ok: true }>['errorCode']) => () =>
  Promise.resolve({ ok: false, errorCode } as const);

describe('ServerActionOrders (TS-ARCH-18, NEXT-ARCH-04)', () => {
  it('calls the action with the command fields', async () => {
    const { action, adapter, reportError } = setUp(() => Promise.resolve({ ok: true }));

    await adapter.cancelOrder('o-1', 'changed my mind');

    expect(action).toHaveBeenCalledExactlyOnceWith({ orderId: 'o-1', reason: 'changed my mind' });
    expect(reportError.report).not.toHaveBeenCalled();
  });

  it.each([
    ['ORDER_NOT_FOUND', OrderNotFound],
    ['ORDER_ALREADY_SHIPPED', OrderAlreadyShipped],
    ['UNAUTHENTICATED', UnauthenticatedError],
  ] as const)('maps %s to its domain error without a report', async (errorCode, type) => {
    const { adapter, reportError } = setUp(failed(errorCode));

    await expect(adapter.cancelOrder('o-1', 'reason')).rejects.toBeInstanceOf(type);
    expect(reportError.report).not.toHaveBeenCalled();
  });

  it.each([
    ['a network failure', new TypeError('Failed to fetch'), 'network'],
    ['an action that threw on the server', new Error('An error occurred in the Server Components render.'), 'server'],
  ])('reports %s once, as the technical error it creates', async (_, rejection, kind) => {
    const { adapter, reportError } = setUp(() => Promise.reject(rejection));

    const failure: unknown = await adapter.cancelOrder('o-1', 'reason').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(TechnicalError);
    expect(failure).toMatchObject({ failure: kind, cause: rejection });
    expect(reportError.report).toHaveBeenCalledExactlyOnceWith(failure);
  });

  it('reports INVALID_INPUT once: the browser sent what the action refuses, a bug of this app', async () => {
    const { adapter, reportError } = setUp(failed('INVALID_INPUT'));

    const failure: unknown = await adapter.cancelOrder('o-1', 'reason').catch((error: unknown) => error);

    expect(failure).toMatchObject({ name: 'TechnicalError', failure: 'unexpected' });
    expect(reportError.report).toHaveBeenCalledExactlyOnceWith(failure);
  });

  it('does not report TECHNICAL: the server logged the failure where it arose', async () => {
    const { adapter, reportError } = setUp(failed('TECHNICAL'));

    await expect(adapter.cancelOrder('o-1', 'reason')).rejects.toMatchObject({ failure: 'server' });
    expect(reportError.report).not.toHaveBeenCalled();
  });
});
