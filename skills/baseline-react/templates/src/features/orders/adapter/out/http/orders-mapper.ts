import type { z } from 'zod';

import { HttpProblem } from '../../../../../platform';
import { TechnicalError } from '../../../../../platform/domain';
import type { Order, OrderPage } from '../../../domain/order';
import { CancelOrderRejected, OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';
import type { CancelOrderResponse, ListOrdersResponse } from './generated/endpoints/orders/orders.zod';

type OrderDto = z.output<typeof CancelOrderResponse>;

export function toOrder(dto: OrderDto): Order {
  return {
    id: dto.id,
    number: dto.number,
    status: dto.status,
    total: { amount: dto.total.amount, currency: dto.total.currency },
    createdAt: new Date(dto.createdAt),
  };
}

export function toOrderPage(dto: z.output<typeof ListOrdersResponse>): OrderPage {
  return {
    items: dto.items.map(toOrder),
    page: dto.page.number,
    totalPages: dto.page.totalPages,
    totalElements: dto.page.totalElements,
  };
}

/** Loading a page has no business errors: any problem answer is unexpected; `HttpProblem` never leaves the adapter. */
export function toLoadOrdersError(error: unknown): unknown {
  return error instanceof HttpProblem ? new TechnicalError('unexpected', { cause: error }) : error;
}

/** The one place that turns problem codes and statuses into the feature's domain errors (TS-ARCH-18). */
export function toOrdersError(error: unknown, orderId: string): unknown {
  if (!(error instanceof HttpProblem)) return error; // TechnicalError or the caller's abort: unchanged
  if (error.problem.code === 'ORDER_ALREADY_SHIPPED') return new OrderAlreadyShipped(orderId);
  if (error.status === 404) return new OrderNotFound(orderId);
  if (error.status === 400) return new CancelOrderRejected(error.problem.errors ?? []);
  return new TechnicalError('unexpected', { cause: error });
}
