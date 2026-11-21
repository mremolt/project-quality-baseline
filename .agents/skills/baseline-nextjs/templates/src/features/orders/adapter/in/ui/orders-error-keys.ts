import { TechnicalError, UnauthenticatedError } from '@/platform';

import { OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';

export type OrdersErrorKey =
  'errors.alreadyShipped' | 'errors.notFound' | 'errors.unauthenticated' | 'errors.technical';

/** Domain errors to translation keys, once for the feature (TS-ARCH-18, REACT-STATE-07). */
export function ordersErrorKey(error: unknown): OrdersErrorKey {
  if (error instanceof OrderAlreadyShipped) return 'errors.alreadyShipped';
  if (error instanceof OrderNotFound) return 'errors.notFound';
  if (error instanceof UnauthenticatedError) return 'errors.unauthenticated';
  return 'errors.technical';
}

/** Neither a domain error nor a platform error: a bug, reported by the mutation (REACT-STATE-07). */
export function isUnexpected(error: unknown): boolean {
  return ordersErrorKey(error) === 'errors.technical' && !(error instanceof TechnicalError);
}
