import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { Order } from '../domain/order';
import type { LoadOrdersPort } from '../ports/out/load-orders.port';
import { ListOrdersService } from './list-orders.service';

const order = (id: string, placedAt: string): Order => ({
  id,
  number: id,
  status: 'OPEN',
  total: { amount: '1.00', currency: 'EUR' },
  placedAt: new Date(placedAt),
});

describe('ListOrdersService', () => {
  const load = mock<LoadOrdersPort>();
  const service = new ListOrdersService(load);

  it('returns the orders newest first', async () => {
    const signal = new AbortController().signal;
    load.loadOrders
      .calledWith(signal)
      .mockResolvedValue([order('old', '2026-01-01T00:00:00Z'), order('new', '2026-02-01T00:00:00Z')]);

    const orders = await service.listOrders(signal);

    expect(orders.map((o) => o.id)).toEqual(['new', 'old']);
  });
});
