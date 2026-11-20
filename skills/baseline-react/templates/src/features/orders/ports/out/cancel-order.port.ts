import type { Order } from '../../domain/order';
import type { CancelOrderCommand } from '../in/cancel-order.use-case';

export interface CancelOrderPort {
  cancelOrder(command: CancelOrderCommand, signal?: AbortSignal): Promise<Order>;
}
