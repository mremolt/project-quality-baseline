import type { z } from 'zod';

import type { ReportErrorUseCase } from '../../../../../platform';
import { TechnicalError } from '../../../../../platform/domain';
import type { Order, OrderPage } from '../../../domain/order';
import type { CancelOrderCommand } from '../../../ports/in/cancel-order.use-case';
import type { LoadOrdersQuery } from '../../../ports/in/load-orders.use-case';
import type { CancelOrderPort } from '../../../ports/out/cancel-order.port';
import type { LoadOrdersPort } from '../../../ports/out/load-orders.port';
import { cancelOrder, listOrders } from './generated/endpoints/orders/orders';
import { CancelOrderResponse, ListOrdersResponse } from './generated/endpoints/orders/orders.zod';
import { toLoadOrdersError, toOrder, toOrderPage, toOrdersError } from './orders-mapper';

/**
 * The orders API behind the feature's outgoing ports. It reports the technical errors it creates itself (a body that
 * does not match the contract, a problem it cannot map); the mutator has already reported its own (TS-ARCH-18,
 * REACT-OBS-04). `reportError` comes from the feature's composition (REACT-ARCH-10).
 */
export class HttpOrders implements LoadOrdersPort, CancelOrderPort {
  constructor(private readonly reportError: ReportErrorUseCase) {}

  async loadOrders(query: LoadOrdersQuery, signal?: AbortSignal): Promise<OrderPage> {
    let body: unknown;
    try {
      body = await listOrders({ page: query.page, size: query.size }, { signal: signal ?? null });
    } catch (error) {
      throw this.reportedIfCreated(toLoadOrdersError(error), error);
    }
    return toOrderPage(this.parse(ListOrdersResponse, body));
  }

  async cancelOrder(command: CancelOrderCommand, signal?: AbortSignal): Promise<Order> {
    let body: unknown;
    try {
      body = await cancelOrder(command.orderId, { reason: command.reason }, { signal: signal ?? null });
    } catch (error) {
      throw this.reportedIfCreated(toOrdersError(error, command.orderId), error);
    }
    return toOrder(this.parse(CancelOrderResponse, body));
  }

  /** A body that does not match the contract becomes a technical error, never a half-filled domain object (TS-API-05). */
  private parse<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
    const result = schema.safeParse(body);
    if (result.success) return result.data;
    const failure = new TechnicalError('malformed-response', { cause: result.error });
    this.reportError.report(failure);
    throw failure;
  }

  /** Reports a `TechnicalError` the mapper created; one passed on unchanged was reported where it was created. */
  private reportedIfCreated(mapped: unknown, original: unknown): unknown {
    if (mapped !== original && mapped instanceof TechnicalError) this.reportError.report(mapped);
    return mapped;
  }
}
