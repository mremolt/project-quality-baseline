import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { configureHttp, type ReportErrorUseCase } from '../../../../../platform';
import { TechnicalError } from '../../../../../platform/domain';
import { OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';
import { CancelOrderCommand } from '../../../ports/in/cancel-order.use-case';
import {
  getCancelOrderMockHandler,
  getCancelOrderResponseMock,
  getListOrdersMockHandler,
  getListOrdersResponseMock,
} from './generated/endpoints/orders/orders.msw';
import { HttpOrders } from './http-orders';

const server = setupServer();
const problem = (status: number, code?: string) =>
  HttpResponse.json(
    { type: 'about:blank', title: 'Problem', status, ...(code && { code }), traceId: 'trace-1' },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
const command = CancelOrderCommand.of({ orderId: 'o-1', reason: 'Ordered twice' });

describe('HttpOrders', () => {
  const reportError = mock<ReportErrorUseCase>();
  const adapter = new HttpOrders();

  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
  });
  beforeEach(() => {
    configureHttp({ timeoutMs: 1_000, onUnauthorized: () => undefined, reportError });
  });
  afterEach(() => {
    server.resetHandlers();
    reportError.report.mockReset();
  });
  afterAll(() => {
    server.close();
  });

  it('maps a page of orders to domain orders', async () => {
    const dto = getListOrdersResponseMock({
      items: [getCancelOrderResponseMock({ id: 'o-7', status: 'OPEN' })],
      page: { number: 0, size: 20, totalElements: 1, totalPages: 1 },
    });
    server.use(getListOrdersMockHandler(dto));

    const page = await adapter.loadOrders({ page: 0, size: 20 });

    expect(page).toEqual({
      items: [
        {
          id: 'o-7',
          number: 'A-1001',
          status: 'OPEN',
          total: { amount: '129.90', currency: 'EUR' },
          createdAt: new Date('2026-11-02T10:15:00Z'),
        },
      ],
      page: 0,
      totalPages: 1,
      totalElements: 1,
    });
  });

  it('sends page and size as query parameters', async () => {
    let requested: URL | undefined;
    server.use(
      getListOrdersMockHandler(({ request }) => {
        requested = new URL(request.url);
        return getListOrdersResponseMock();
      }),
    );

    await adapter.loadOrders({ page: 2, size: 10 });

    expect(requested?.searchParams.toString()).toBe('page=2&size=10');
  });

  it('rejects a malformed response with a technical error', async () => {
    server.use(getListOrdersMockHandler({ items: [{ id: 42 }] } as never));

    await expect(adapter.loadOrders({ page: 0, size: 20 })).rejects.toMatchObject({ failure: 'malformed-response' });
  });

  it('turns a server error into a reported technical error with the trace id', async () => {
    server.use(http.get('*/api/v1/orders', () => problem(503)));

    await expect(adapter.loadOrders({ page: 0, size: 20 })).rejects.toBeInstanceOf(TechnicalError);
    expect(reportError.report).toHaveBeenCalledWith(expect.any(TechnicalError), { status: 503, traceId: 'trace-1' });
  });

  it('cancels an order and returns the cancelled order', async () => {
    server.use(getCancelOrderMockHandler(getCancelOrderResponseMock({ id: 'o-1', status: 'CANCELLED' })));

    await expect(adapter.cancelOrder(command)).resolves.toMatchObject({ id: 'o-1', status: 'CANCELLED' });
  });

  it('maps ORDER_ALREADY_SHIPPED to the business error', async () => {
    server.use(http.post('*/api/v1/orders/:orderId/cancel', () => problem(409, 'ORDER_ALREADY_SHIPPED')));

    await expect(adapter.cancelOrder(command)).rejects.toEqual(new OrderAlreadyShipped('o-1'));
    expect(reportError.report).not.toHaveBeenCalled();
  });

  it('maps 404 to OrderNotFound', async () => {
    server.use(http.post('*/api/v1/orders/:orderId/cancel', () => problem(404)));

    await expect(adapter.cancelOrder(command)).rejects.toEqual(new OrderNotFound('o-1'));
  });

  it('maps an unknown 4xx code to a technical error', async () => {
    server.use(http.post('*/api/v1/orders/:orderId/cancel', () => problem(422, 'SOMETHING_NEW')));

    await expect(adapter.cancelOrder(command)).rejects.toMatchObject({ failure: 'unexpected' });
  });
});
