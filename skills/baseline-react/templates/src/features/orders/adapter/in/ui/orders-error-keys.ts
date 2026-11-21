import { TechnicalError } from '../../../../../platform/domain';
import { CancelOrderRejected, OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';

export type OrdersErrorKey = 'alreadyShipped' | 'notFound' | 'invalid' | 'technical';

/** Domain errors → translation keys, once per feature (TS-ARCH-18, REACT-STATE-07). */
export function toErrorKey(error: unknown): OrdersErrorKey {
  if (error instanceof OrderAlreadyShipped) return 'alreadyShipped';
  if (error instanceof OrderNotFound) return 'notFound';
  if (error instanceof CancelOrderRejected) return 'invalid';
  return 'technical';
}

/** Neither a domain error of the feature nor the platform's `TechnicalError`: a bug, to be reported (REACT-STATE-07). */
export function isUnexpected(error: unknown): boolean {
  return toErrorKey(error) === 'technical' && !(error instanceof TechnicalError);
}
