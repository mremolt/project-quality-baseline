import { TechnicalError, UnauthenticatedError } from '@/platform';
import type { ReportErrorUseCase } from '@/platform/index.client';

import { OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';
import type { CancelOrderPort } from '../../../ports/out/cancel-order.port';
import type { cancelOrderAction } from '../../in/next/orders-actions';

/**
 * Browser side of the cancel command: calls the server action (Next's own POST endpoint with its Origin check)
 * and maps its error codes back to domain errors, in this one place (TS-ARCH-18). It reports the technical errors it
 * creates, once: a call that did not return a result, and `INVALID_INPUT` (this app sent what its own action
 * refuses). `TECHNICAL` is not reported again: the server logged that failure where it arose.
 */
export class ServerActionOrders implements CancelOrderPort {
  constructor(
    private readonly action: typeof cancelOrderAction,
    private readonly reportError: ReportErrorUseCase,
  ) {}

  async cancelOrder(orderId: string, reason: string): Promise<void> {
    const result = await this.action({ orderId, reason }).catch((error: unknown) => {
      throw this.reported(
        new TechnicalError('cancel order action failed', {
          cause: error,
          failure: error instanceof TypeError ? 'network' : 'server', // fetch rejects with a TypeError
        }),
      );
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
        throw this.reported(new TechnicalError('cancel order action refused the input', { failure: 'unexpected' }));
      case 'TECHNICAL':
        throw new TechnicalError('cancel order action answered TECHNICAL', { failure: 'server' });
    }
  }

  private reported(error: TechnicalError): TechnicalError {
    this.reportError.report(error);
    return error;
  }
}
