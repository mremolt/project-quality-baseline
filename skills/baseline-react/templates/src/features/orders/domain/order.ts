export type OrderStatus = 'OPEN' | 'SHIPPED' | 'CANCELLED';

/** A decimal amount kept as a string, never a float (API-REST-01). */
export interface Money {
  readonly amount: string;
  readonly currency: string;
}

export interface Order {
  readonly id: string;
  readonly number: string;
  readonly status: OrderStatus;
  readonly total: Money;
  readonly createdAt: Date;
}

export interface OrderPage {
  readonly items: readonly Order[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalElements: number;
}

export function canBeCancelled(order: Order): boolean {
  return order.status === 'OPEN';
}

export function hasPreviousPage(page: OrderPage): boolean {
  return page.page > 0;
}

export function hasNextPage(page: OrderPage): boolean {
  return page.page + 1 < page.totalPages;
}
