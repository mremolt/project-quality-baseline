import { type ReactNode, useState } from 'react';

import { type ReportErrorUseCase, useReportError } from '../../platform';
import { HttpOrders } from './adapter/out/http/http-orders';
import { CancelOrderService } from './application/cancel-order.service';
import { LoadOrdersService } from './application/load-orders.service';
import { OrdersContext, type OrdersUseCases } from './orders.tokens';

/** What the use cases need from the platform; config values would be added here (REACT-CFG-04). */
export interface OrdersPlatform {
  readonly reportError: ReportErrorUseCase;
}

/** Creates the adapters and use cases of the feature (TS-ARCH-09); stateless, so one set per provider is enough. */
export function createOrdersUseCases({ reportError }: OrdersPlatform): OrdersUseCases {
  const http = new HttpOrders(reportError);
  return { loadOrders: new LoadOrdersService(http), cancelOrder: new CancelOrderService(http) };
}

/**
 * Provides the feature's use cases, created once per mount from the platform values (REACT-ARCH-10). Other features
 * wrap their screens in it and reach only the selector hooks `index.ts` publishes (REACT-ARCH-11, TS-ARCH-19). This
 * file imports adapters, use cases and the context only: no page, no slice, so a consumer does not load them.
 */
export function OrdersApiProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const reportError = useReportError();
  const [useCases] = useState(() => createOrdersUseCases({ reportError }));
  return <OrdersContext value={useCases}>{children}</OrdersContext>;
}
