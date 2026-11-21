import { HttpProblem, TechnicalError, UnauthenticatedError } from '@/platform';

import { OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';

/**
 * The one place that turns HTTP answers of the orders API into domain errors (TS-ARCH-18). A 5xx becomes a `server`
 * failure (the browser mutator has reported it); anything it cannot map becomes an `unexpected` one, which the adapter
 * reports.
 */
export function toOrdersError(error: unknown, orderId?: string): Error {
  if (error instanceof UnauthenticatedError || error instanceof TechnicalError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return error; // cancelled by the caller
  if (error instanceof HttpProblem && error.status >= 500) {
    return new TechnicalError('orders API failed', { cause: error, failure: 'server' });
  }
  if (error instanceof HttpProblem && orderId !== undefined) {
    if (error.problem.code === 'ORDER_ALREADY_SHIPPED') return new OrderAlreadyShipped(orderId);
    if (error.status === 404) return new OrderNotFound(orderId);
  }
  return new TechnicalError('orders API call failed', { cause: error, failure: 'unexpected' });
}
