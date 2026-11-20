import type { z } from 'zod';

import { TechnicalError } from '../../../../../platform/domain';
import type { Order, OrderPage } from '../../../domain/order';
import type { CancelOrderCommand } from '../../../ports/in/cancel-order.use-case';
import type { LoadOrdersQuery } from '../../../ports/in/load-orders.use-case';
import type { CancelOrderPort } from '../../../ports/out/cancel-order.port';
import type { LoadOrdersPort } from '../../../ports/out/load-orders.port';
import { cancelOrder, listOrders } from './generated/endpoints/orders/orders';
import { CancelOrderResponse, ListOrdersResponse } from './generated/endpoints/orders/orders.zod';
import { toOrder, toOrderPage, toOrdersError } from './orders-mapper';

/** A body that does not match the contract becomes a technical error, never a half-filled domain object (TS-API-05). */
function parse<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success) throw new TechnicalError('malformed-response', { cause: result.error });
  return result.data;
}

export class HttpOrders implements LoadOrdersPort, CancelOrderPort {
  async loadOrders(query: LoadOrdersQuery, signal?: AbortSignal): Promise<OrderPage> {
    const body: unknown = await listOrders({ page: query.page, size: query.size }, { signal: signal ?? null });
    return toOrderPage(parse(ListOrdersResponse, body));
  }

  async cancelOrder(command: CancelOrderCommand, signal?: AbortSignal): Promise<Order> {
    try {
      const body: unknown = await cancelOrder(command.orderId, { reason: command.reason }, { signal: signal ?? null });
      return toOrder(parse(CancelOrderResponse, body));
    } catch (error) {
      throw toOrdersError(error, command.orderId);
    }
  }
}
