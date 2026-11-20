import { describe, expect, it } from 'vitest';

import { canBeCancelled, hasNextPage, hasPreviousPage, type Order, type OrderPage } from './order';

const order = (status: Order['status']): Order => ({
  id: 'o-1',
  number: 'A-1001',
  status,
  total: { amount: '10.00', currency: 'EUR' },
  createdAt: new Date('2026-11-02T10:15:00Z'),
});

const page = (current: number, totalPages: number): OrderPage => ({
  items: [],
  page: current,
  totalPages,
  totalElements: totalPages * 20,
});

describe('canBeCancelled', () => {
  it('allows open orders', () => {
    expect(canBeCancelled(order('OPEN'))).toBe(true);
  });

  it.each(['SHIPPED', 'CANCELLED'] as const)('rejects %s orders', (status) => {
    expect(canBeCancelled(order(status))).toBe(false);
  });
});

describe('paging', () => {
  it('has no previous page on the first page', () => {
    expect(hasPreviousPage(page(0, 3))).toBe(false);
    expect(hasPreviousPage(page(1, 3))).toBe(true);
  });

  it('has no next page on the last page', () => {
    expect(hasNextPage(page(1, 3))).toBe(true);
    expect(hasNextPage(page(2, 3))).toBe(false);
    expect(hasNextPage(page(0, 0))).toBe(false);
  });
});
