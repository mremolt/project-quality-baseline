import { describe, expect, it } from 'vitest';

import type { Order, OrderStatus } from './order';
import { canCancel } from './order';

const order = (status: OrderStatus): Order => ({
  id: 'o-1',
  number: '2026-0001',
  status,
  total: { amount: '129.90', currency: 'EUR' },
  placedAt: new Date('2026-11-01T10:15:00Z'),
});

describe('canCancel', () => {
  it('allows cancelling an open order', () => {
    expect(canCancel(order('OPEN'))).toBe(true);
  });

  it.each<OrderStatus>(['SHIPPED', 'CANCELLED'])('refuses a %s order', (status) => {
    expect(canCancel(order(status))).toBe(false);
  });
});
