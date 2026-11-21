import { cancelOrder, listOrders } from './generated/browser/orders/orders';
import { HttpOrders } from './http-orders';

/** Browser side: same-origin calls through the BFF's API proxy. */
export function createBrowserHttpOrders(): HttpOrders {
  return new HttpOrders({ listOrders, cancelOrder });
}
