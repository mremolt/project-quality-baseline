import type { Order } from '../../domain/order';

export interface LoadOrdersPort {
  loadOrders(signal?: AbortSignal): Promise<readonly Order[]>;
}
