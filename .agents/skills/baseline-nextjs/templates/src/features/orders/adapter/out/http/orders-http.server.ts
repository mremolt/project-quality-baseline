import 'server-only';

import { serverReportError } from '@/platform/index.server';

import { cancelOrder, listOrders } from './generated/server/orders/orders';
import { HttpOrders } from './http-orders';

/**
 * Server side: direct backend calls with the session's access token. A technical error the adapter creates is logged
 * once by the platform's server reporter, with the request's trace id, and marked, so `onRequestError` does not log
 * it again (TS-ARCH-18, NEXT-OBS-09).
 */
export function createServerHttpOrders(): HttpOrders {
  return new HttpOrders({ listOrders, cancelOrder }, serverReportError);
}
