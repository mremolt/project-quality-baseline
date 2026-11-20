import type { OrderPage } from '../../domain/order';
import type { LoadOrdersQuery } from '../in/load-orders.use-case';

export interface LoadOrdersPort {
  loadOrders(query: LoadOrdersQuery, signal?: AbortSignal): Promise<OrderPage>;
}
