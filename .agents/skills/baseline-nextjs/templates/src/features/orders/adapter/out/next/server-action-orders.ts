import { TechnicalError, UnauthenticatedError } from '@/platform';

import { OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';
import type { CancelOrderPort } from '../../../ports/out/cancel-order.port';
import type { cancelOrderAction } from '../../in/next/orders-actions';

/**
 * Browser side of the cancel command: calls the server action (Next's own POST endpoint with its Origin check)
 * and maps its error codes back to domain errors, in this one place (TS-ARCH-18).
 */
export class ServerActionOrders implements CancelOrderPort {
  constructor(private readonly action: typeof cancelOrderAction) {}

  async cancelOrder(orderId: string, reason: string): Promise<void> {
    const result = await this.action({ orderId, reason }).catch((error: unknown) => {
      throw new TechnicalError('cancel order action failed', { cause: error });
    });
    if (result.ok) return;
    switch (result.errorCode) {
      case 'ORDER_NOT_FOUND':
        throw new OrderNotFound(orderId);
      case 'ORDER_ALREADY_SHIPPED':
        throw new OrderAlreadyShipped(orderId);
      case 'UNAUTHENTICATED':
        throw new UnauthenticatedError('session missing or expired');
      case 'INVALID_INPUT':
      case 'TECHNICAL':
        throw new TechnicalError(`cancel order action answered ${result.errorCode}`);
    }
  }
}
