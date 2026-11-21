import type { ReactNode } from 'react';

import { rootReducer } from '../../platform';
import { ordersSlice } from './adapter/in/ui/orders.slice';
import { OrdersPage } from './adapter/in/ui/orders-page';
import { OrdersApiProvider } from './orders.api';

// Runs once, when the route chunk loads: the slice, the page and the adapters never reach the main bundle.
rootReducer.inject(ordersSlice);

/** The lazily loaded route component (`orders.routes.ts`): the page inside the feature's use-case provider. */
export function OrdersScreen(): ReactNode {
  return (
    <OrdersApiProvider>
      <OrdersPage />
    </OrdersApiProvider>
  );
}
