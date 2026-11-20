import type { OrderPage } from '../domain/order';
import type { LoadOrdersQuery, LoadOrdersUseCase } from '../ports/in/load-orders.use-case';
import type { LoadOrdersPort } from '../ports/out/load-orders.port';

export class LoadOrdersService implements LoadOrdersUseCase {
  constructor(private readonly orders: LoadOrdersPort) {}

  load(query: LoadOrdersQuery, signal?: AbortSignal): Promise<OrderPage> {
    return this.orders.loadOrders(query, signal);
  }
}
