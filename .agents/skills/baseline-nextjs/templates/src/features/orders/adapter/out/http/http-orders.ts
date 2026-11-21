import type { Order } from '../../../domain/order';
import type { CancelOrderPort } from '../../../ports/out/cancel-order.port';
import type { LoadOrdersPort } from '../../../ports/out/load-orders.port';
import type { cancelOrder, listOrders } from './generated/browser/orders/orders';
import { ListOrdersResponse } from './generated/zod/orders/orders.zod';
import { toOrdersError } from './orders-error-mapper';
import { toOrder } from './orders-mapper';

/** The generated operations; browser and server clients share these signatures and differ only in their mutator. */
export interface OrdersApi {
  readonly listOrders: typeof listOrders;
  readonly cancelOrder: typeof cancelOrder;
}

export class HttpOrders implements LoadOrdersPort, CancelOrderPort {
  constructor(private readonly api: OrdersApi) {}

  async loadOrders(signal?: AbortSignal): Promise<readonly Order[]> {
    try {
      const page = ListOrdersResponse.parse(
        await this.api.listOrders({ page: 0, size: 100 }, signal ? { signal } : {}),
      );
      return page.items.map(toOrder);
    } catch (error) {
      throw toOrdersError(error);
    }
  }

  async cancelOrder(orderId: string, reason: string): Promise<void> {
    try {
      await this.api.cancelOrder(orderId, { reason });
    } catch (error) {
      throw toOrdersError(error, orderId);
    }
  }
}
