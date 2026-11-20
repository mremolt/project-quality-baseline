import type { Order } from '../domain/order';
import type { CancelOrderCommand, CancelOrderUseCase } from '../ports/in/cancel-order.use-case';
import type { CancelOrderPort } from '../ports/out/cancel-order.port';

export class CancelOrderService implements CancelOrderUseCase {
  constructor(private readonly orders: CancelOrderPort) {}

  cancel(command: CancelOrderCommand, signal?: AbortSignal): Promise<Order> {
    return this.orders.cancelOrder(command, signal);
  }
}
