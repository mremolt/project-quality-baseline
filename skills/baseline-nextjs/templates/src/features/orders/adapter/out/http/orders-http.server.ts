import 'server-only';

import { logger } from '@/platform/index.server';

import { cancelOrder, listOrders } from './generated/server/orders/orders';
import { HttpOrders } from './http-orders';

/** Server side: a technical error the adapter creates is logged once, with the request's trace id (NEXT-OBS-07/08). */
// The reporter type through the adapter: a server file never imports the client platform entry (NEXT-ARCH-14).
const logReportError: ConstructorParameters<typeof HttpOrders>[1] = {
  report(error, details) {
    logger.error({ err: error, ...details }, 'orders API answer not usable');
  },
};

/** Server side: direct backend calls with the session's access token. */
export function createServerHttpOrders(): HttpOrders {
  return new HttpOrders({ listOrders, cancelOrder }, logReportError);
}
