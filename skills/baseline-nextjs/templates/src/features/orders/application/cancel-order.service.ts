import type { CancelOrderCommand, CancelOrderUseCase } from '../ports/in/cancel-order.use-case';
import type { CancelOrderPort } from '../ports/out/cancel-order.port';

export class CancelOrderService implements CancelOrderUseCase {
  constructor(private readonly orders: CancelOrderPort) {}

  async cancelOrder(command: CancelOrderCommand): Promise<void> {
    await this.orders.cancelOrder(command.orderId, command.reason);
  }
}
