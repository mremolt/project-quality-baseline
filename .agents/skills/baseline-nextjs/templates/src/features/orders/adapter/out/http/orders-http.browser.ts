import type { ReportErrorUseCase } from '@/platform/index.client';

import { cancelOrder, listOrders } from './generated/browser/orders/orders';
import { HttpOrders } from './http-orders';

/** Browser side: same-origin calls through the BFF's API proxy; reports go to the BFF's client-error intake. */
export function createBrowserHttpOrders(reportError: ReportErrorUseCase): HttpOrders {
  return new HttpOrders({ listOrders, cancelOrder }, reportError);
}
