import type { Order } from '../../domain/order';

export interface ListOrdersUseCase {
  /** The caller's orders, newest first. */
  listOrders(signal?: AbortSignal): Promise<readonly Order[]>;
}
