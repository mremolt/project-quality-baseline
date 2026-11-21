import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { HttpProblem, TechnicalError } from '@/platform';
import { markReported, wasReported } from '@/platform/domain';
import type { ReportErrorUseCase } from '@/platform/index.client';

import { HttpOrders, type OrdersApi } from './http-orders';

/** What the server mutator throws: it reported (and marked) a 5xx, a time-out and a network failure (TS-ARCH-18). */
function reportedByMutator<T extends Error>(error: T): T {
  markReported(error);
  return error;
}

function setUp(api: Partial<OrdersApi>) {
  const reportError = mock<ReportErrorUseCase>();
  return { reportError, adapter: new HttpOrders(mock<OrdersApi>(api), reportError) };
}

describe('HttpOrders on the server path: every technical error reported once, by its creator', () => {
  it('passes a 5xx the mutator reported on as a server failure, unreported and still marked', async () => {
    const { adapter, reportError } = setUp({
      cancelOrder: () => Promise.reject(reportedByMutator(new HttpProblem(503, { status: 503 }))),
    });

    const failure: unknown = await adapter.cancelOrder('o-1', 'reason').catch((error: unknown) => error);

    expect(failure).toMatchObject({ name: 'TechnicalError', failure: 'server' });
    expect(reportError.report).not.toHaveBeenCalled();
    expect(wasReported(failure)).toBe(true); // onRequestError skips it (NEXT-OBS-09)
  });

  it('passes a time-out the mutator reported on unchanged and unreported', async () => {
    const timeout = reportedByMutator(new TechnicalError('timeout', { failure: 'timeout' }));
    const { adapter, reportError } = setUp({ listOrders: () => Promise.reject(timeout) });

    await expect(adapter.loadOrders()).rejects.toBe(timeout);
    expect(reportError.report).not.toHaveBeenCalled();
  });

  it('reports a malformed body once, because it creates that error', async () => {
    const { adapter, reportError } = setUp({ listOrders: () => Promise.resolve({ items: [{ id: 42 }] } as never) });

    const failure: unknown = await adapter.loadOrders().catch((error: unknown) => error);

    expect(failure).toMatchObject({ failure: 'malformed-response' });
    expect(reportError.report).toHaveBeenCalledExactlyOnceWith(failure);
  });

  it('reports an unknown problem code once, because it creates that error', async () => {
    const { adapter, reportError } = setUp({
      cancelOrder: () => Promise.reject(new HttpProblem(422, { status: 422, code: 'SOMETHING_NEW' })),
    });

    const failure: unknown = await adapter.cancelOrder('o-1', 'reason').catch((error: unknown) => error);

    expect(failure).toMatchObject({ failure: 'unexpected' });
    expect(reportError.report).toHaveBeenCalledExactlyOnceWith(failure);
  });
});
