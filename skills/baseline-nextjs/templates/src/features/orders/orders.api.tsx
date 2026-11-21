'use client';

import { type ReactNode, useState } from 'react';

import { type ReportErrorUseCase, useReportError } from '@/platform/index.client';

import { cancelOrderAction } from './adapter/in/next/orders-actions';
import { createBrowserHttpOrders } from './adapter/out/http/orders-http.browser';
import { ServerActionOrders } from './adapter/out/next/server-action-orders';
import { CancelOrderService } from './application/cancel-order.service';
import { ListOrdersService } from './application/list-orders.service';
import { OrdersContext, type OrdersUseCases } from './orders.tokens';

/** What the browser use cases need from the platform (REACT-ARCH-10). */
export interface OrdersPlatform {
  readonly reportError: ReportErrorUseCase;
}

/** Creates the browser adapters and use cases of the feature (TS-ARCH-09); stateless, one set per provider. */
export function createOrdersUseCases({ reportError }: OrdersPlatform): OrdersUseCases {
  return {
    listOrders: new ListOrdersService(createBrowserHttpOrders(reportError)),
    cancelOrder: new CancelOrderService(new ServerActionOrders(cancelOrderAction)),
  };
}

/**
 * Provides the feature's browser use cases, created once per mount from the platform values (REACT-ARCH-10). Other
 * features wrap their client screens in it and use only the selector hooks `index.ts` publishes (REACT-ARCH-11).
 * Imports adapters, use cases and the context only: no UI, no slice.
 */
export function OrdersApiProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const reportError = useReportError();
  const [useCases] = useState(() => createOrdersUseCases({ reportError }));
  return <OrdersContext value={useCases}>{children}</OrdersContext>;
}
