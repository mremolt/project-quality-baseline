import { CancelOrderRejected, OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';

export type OrdersErrorKey = 'alreadyShipped' | 'notFound' | 'invalid' | 'technical';

/** Domain errors → translation keys, once per feature (TS-ARCH-18). */
export function toErrorKey(error: unknown): OrdersErrorKey {
  if (error instanceof OrderAlreadyShipped) return 'alreadyShipped';
  if (error instanceof OrderNotFound) return 'notFound';
  if (error instanceof CancelOrderRejected) return 'invalid';
  return 'technical';
}
