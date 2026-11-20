import type { ReactNode } from 'react';

import { rootReducer } from '../../platform';
import { ordersSlice } from './adapter/in/ui/orders.slice';
import { OrdersPage } from './adapter/in/ui/orders-page';
import { HttpOrders } from './adapter/out/http/http-orders';
import { CancelOrderService } from './application/cancel-order.service';
import { LoadOrdersService } from './application/load-orders.service';
import { CancelOrderContext, LoadOrdersContext } from './orders.tokens';

// Runs once, when the route chunk loads: the slice and the adapters never reach the main bundle.
rootReducer.inject(ordersSlice);
const http = new HttpOrders();
const loadOrders = new LoadOrdersService(http);
const cancelOrder = new CancelOrderService(http);

/** Everything the feature's own screens need (TS-ARCH-09). */
export function OrdersProvider({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <LoadOrdersContext value={loadOrders}>
      <CancelOrderContext value={cancelOrder}>{children}</CancelOrderContext>
    </LoadOrdersContext>
  );
}

/** Exactly the published use cases, for other features (TS-ARCH-19). */
export function OrdersApiProvider({ children }: { readonly children: ReactNode }): ReactNode {
  return <LoadOrdersContext value={loadOrders}>{children}</LoadOrdersContext>;
}

/** The lazily loaded route component (`orders.routes.ts`). */
export function OrdersScreen(): ReactNode {
  return (
    <OrdersProvider>
      <OrdersPage />
    </OrdersProvider>
  );
}
