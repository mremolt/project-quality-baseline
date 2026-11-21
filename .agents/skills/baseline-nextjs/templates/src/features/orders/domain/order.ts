export type OrderStatus = 'OPEN' | 'SHIPPED' | 'CANCELLED';

/** A decimal amount kept as its exact string (API-REST-01); never a binary floating-point number. */
export interface Money {
  readonly amount: string;
  readonly currency: string;
}

export interface Order {
  readonly id: string;
  readonly number: string;
  readonly status: OrderStatus;
  readonly total: Money;
  readonly placedAt: Date;
}

/** Only open orders can be cancelled; shipped and cancelled ones cannot. */
export function canCancel(order: Order): boolean {
  return order.status === 'OPEN';
}
