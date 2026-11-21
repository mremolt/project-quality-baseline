// @vitest-environment jsdom
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { TechnicalError } from '@/platform';
import { configureHttp, type ReportErrorUseCase } from '@/platform/index.client';

import { OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';
import { getCancelOrderMockHandler, getListOrdersMockHandler } from './generated/browser/orders/orders.msw';
import { createBrowserHttpOrders } from './orders-http.browser';
import { STUB_ORDERS } from './orders-stub-handlers';

const problem = (status: number, code?: string) =>
  HttpResponse.json(
    { type: 'about:blank', title: 'x', status, ...(code ? { code } : {}) },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );

describe('HttpOrders against the contract stubs', () => {
  const server = setupServer();
  const adapter = createBrowserHttpOrders();

  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
    configureHttp({ timeoutMs: 1_000, onUnauthorized: () => undefined, reportError: mock<ReportErrorUseCase>() });
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });

  it('maps the page to domain orders', async () => {
    server.use(getListOrdersMockHandler({ items: STUB_ORDERS.slice(0, 1), page: 0, size: 100, totalElements: 1 }));

    const orders = await adapter.loadOrders();

    expect(orders).toEqual([
      {
        id: 'o-1',
        number: '2026-0001',
        status: 'OPEN',
        total: { amount: '129.90', currency: 'EUR' },
        placedAt: new Date('2026-11-01T10:15:00Z'),
      },
    ]);
  });

  it('rejects a malformed response with a technical error', async () => {
    server.use(getListOrdersMockHandler({ items: [{ id: 42 }] } as never));

    await expect(adapter.loadOrders()).rejects.toBeInstanceOf(TechnicalError);
  });

  it('maps ORDER_ALREADY_SHIPPED to the domain error', async () => {
    server.use(http.post('*/api/v1/orders/:id/cancel', () => problem(409, 'ORDER_ALREADY_SHIPPED')));

    await expect(adapter.cancelOrder('o-2', 'too late')).rejects.toEqual(new OrderAlreadyShipped('o-2'));
  });

  it('maps 404 to OrderNotFound', async () => {
    server.use(http.post('*/api/v1/orders/:id/cancel', () => problem(404)));

    await expect(adapter.cancelOrder('o-9', 'gone')).rejects.toBeInstanceOf(OrderNotFound);
  });

  it('maps a server error to a technical error', async () => {
    server.use(http.post('*/api/v1/orders/:id/cancel', () => problem(500)));

    await expect(adapter.cancelOrder('o-1', 'reason')).rejects.toBeInstanceOf(TechnicalError);
  });

  it('sends the cancel reason', async () => {
    let body: unknown;
    server.use(
      getCancelOrderMockHandler(async ({ request }) => {
        body = await request.json();
      }),
    );

    await adapter.cancelOrder('o-1', 'changed my mind');

    expect(body).toEqual({ reason: 'changed my mind' });
  });
});
