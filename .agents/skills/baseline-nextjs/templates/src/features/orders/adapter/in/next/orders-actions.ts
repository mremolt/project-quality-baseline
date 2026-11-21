'use server';

import { currentCaller } from '@/platform/index.server';

import { ordersServerUseCases } from '../../../orders.composition.server';
import { type CancelOrderActionResult, handleCancelOrder } from './cancel-order.handler';

/** Server action: binds the handler to the session and the server composition (NEXT-ARCH-04, NEXT-TEST-06). */
export async function cancelOrderAction(input: unknown): Promise<CancelOrderActionResult> {
  return handleCancelOrder(input, { currentCaller, cancelOrder: ordersServerUseCases().cancelOrder });
}
