import type { Order } from '../domain/order';
import type { ListOrdersUseCase } from '../ports/in/list-orders.use-case';
import type { LoadOrdersPort } from '../ports/out/load-orders.port';

export class ListOrdersService implements ListOrdersUseCase {
  constructor(private readonly orders: LoadOrdersPort) {}

  async listOrders(signal?: AbortSignal): Promise<readonly Order[]> {
    const orders = await this.orders.loadOrders(signal);
    return orders.toSorted((a, b) => b.placedAt.getTime() - a.placedAt.getTime());
  }
}
