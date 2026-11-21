import 'server-only';

import { cache } from 'react';

import { createServerHttpOrders } from './adapter/out/http/orders-http.server';
import { CancelOrderService } from './application/cancel-order.service';
import { ListOrdersService } from './application/list-orders.service';
import type { CancelOrderUseCase } from './ports/in/cancel-order.use-case';
import type { ListOrdersUseCase } from './ports/in/list-orders.use-case';

export interface OrdersServerUseCases {
  readonly listOrders: ListOrdersUseCase;
  readonly cancelOrder: CancelOrderUseCase;
}

/** Server composition of the feature: one set of adapters and use cases per request (React `cache`). */
export const ordersServerUseCases = cache((): OrdersServerUseCases => {
  const http = createServerHttpOrders();
  return { listOrders: new ListOrdersService(http), cancelOrder: new CancelOrderService(http) };
});
