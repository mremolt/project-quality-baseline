import { http, HttpResponse } from 'msw';

import { getCancelOrderMockHandler, getListOrdersMockHandler } from './generated/browser/orders/orders.msw';
import type { Order } from './generated/model';

/** Deterministic contract stubs for the stubbed E2E tier (D10); built from the Orval-generated handlers. */
export const STUB_ORDERS: Order[] = [
  {
    id: 'o-1',
    number: '2026-0001',
    status: 'OPEN',
    total: '129.90',
    currency: 'EUR',
    placedAt: '2026-11-01T10:15:00Z',
  },
  {
    id: 'o-2',
    number: '2026-0002',
    status: 'SHIPPED',
    total: '15.00',
    currency: 'EUR',
    placedAt: '2026-10-20T08:00:00Z',
  },
  {
    id: 'o-3',
    number: '2026-0003',
    status: 'OPEN',
    total: '1000000.05',
    currency: 'EUR',
    placedAt: '2026-09-02T12:30:00Z',
  },
];

export const ordersStubHandlers = [
  getListOrdersMockHandler({ items: STUB_ORDERS, page: 0, size: 100, totalElements: STUB_ORDERS.length }),
  // problem answers are not generated (only the success example is), so this one is written against the contract
  http.post('*/api/v1/orders/o-3/cancel', () =>
    HttpResponse.json(
      { type: 'about:blank', title: 'Conflict', status: 409, code: 'ORDER_ALREADY_SHIPPED' },
      { status: 409, headers: { 'content-type': 'application/problem+json' } },
    ),
  ),
  getCancelOrderMockHandler(),
];
