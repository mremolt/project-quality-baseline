'use client';

import type { ReactNode } from 'react';

import { rootReducer } from '@/platform/index.client';

import { cancelOrderAction } from './adapter/in/next/orders-actions';
import { ordersViewSlice } from './adapter/in/ui/orders-view.slice';
import { createBrowserHttpOrders } from './adapter/out/http/orders-http.browser';
import { ServerActionOrders } from './adapter/out/next/server-action-orders';
import { CancelOrderService } from './application/cancel-order.service';
import { ListOrdersService } from './application/list-orders.service';
import { CancelOrderContext, ListOrdersContext } from './orders.tokens';

rootReducer.inject(ordersViewSlice); // lazily, when the feature's client code loads

// Stateless adapters and use cases: created once per JavaScript realm (browser tab, or the SSR process).
const listOrders = new ListOrdersService(createBrowserHttpOrders());
const cancelOrder = new CancelOrderService(new ServerActionOrders(cancelOrderAction));

/** Client composition of the feature: binds the use-case contracts to their browser implementations. */
export function OrdersComposition({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <ListOrdersContext value={listOrders}>
      <CancelOrderContext value={cancelOrder}>{children}</CancelOrderContext>
    </ListOrdersContext>
  );
}
