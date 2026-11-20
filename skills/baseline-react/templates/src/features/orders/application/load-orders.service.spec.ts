import { describe, expect, it } from 'vitest';
import { matches, mock } from 'vitest-mock-extended';

import type { OrderPage } from '../domain/order';
import type { LoadOrdersQuery } from '../ports/in/load-orders.use-case';
import type { LoadOrdersPort } from '../ports/out/load-orders.port';
import { LoadOrdersService } from './load-orders.service';

describe('LoadOrdersService', () => {
  it('returns the requested page and passes the abort signal on', async () => {
    const port = mock<LoadOrdersPort>();
    const page: OrderPage = { items: [], page: 1, totalPages: 2, totalElements: 21 };
    const signal = new AbortController().signal;
    // calledWith compares with ===; a value object needs a matcher
    port.loadOrders
      .calledWith(
        matches((query: LoadOrdersQuery) => query.page === 1 && query.size === 20),
        signal,
      )
      .mockResolvedValue(page);

    await expect(new LoadOrdersService(port).load({ page: 1, size: 20 }, signal)).resolves.toBe(page);
  });
});
