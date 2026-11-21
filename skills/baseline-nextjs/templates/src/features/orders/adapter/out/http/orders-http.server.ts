import 'server-only';

import { cancelOrder, listOrders } from './generated/server/orders/orders';
import { HttpOrders } from './http-orders';

/** Server side: direct backend calls with the session's access token. */
export function createServerHttpOrders(): HttpOrders {
  return new HttpOrders({ listOrders, cancelOrder });
}
