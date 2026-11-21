import { TechnicalError } from '@/platform';
import type { ReportErrorUseCase } from '@/platform/index.client';

import type { Order } from '../../../domain/order';
import type { CancelOrderPort } from '../../../ports/out/cancel-order.port';
import type { LoadOrdersPort } from '../../../ports/out/load-orders.port';
import type { cancelOrder, listOrders } from './generated/browser/orders/orders';
import { ListOrdersResponse } from './generated/zod/orders/orders.zod';
import { toOrdersError } from './orders-error-mapper';
import { toOrder } from './orders-mapper';

/** The generated operations; browser and server clients share these signatures and differ only in their mutator. */
export interface OrdersApi {
  readonly listOrders: typeof listOrders;
  readonly cancelOrder: typeof cancelOrder;
}

/**
 * The orders API behind the feature's outgoing ports. It reports the technical errors it creates itself (a body that
 * fails the contract's schema, an answer the mapper cannot map); the mutator reported its own (TS-ARCH-18,
 * REACT-OBS-04). The browser and server factories pass the matching `ReportErrorUseCase`.
 */
export class HttpOrders implements LoadOrdersPort, CancelOrderPort {
  constructor(
    private readonly api: OrdersApi,
    private readonly reportError: ReportErrorUseCase,
  ) {}

  async loadOrders(signal?: AbortSignal): Promise<readonly Order[]> {
    let body: unknown;
    try {
      body = await this.api.listOrders({ page: 0, size: 100 }, signal ? { signal } : {});
    } catch (error) {
      throw this.reportedIfCreated(toOrdersError(error), error);
    }
    const page = ListOrdersResponse.safeParse(body);
    if (!page.success) {
      // never a half-filled domain object (TS-API-05)
      const failure = new TechnicalError('orders API answered with a malformed body', {
        cause: page.error,
        failure: 'malformed-response',
      });
      this.reportError.report(failure);
      throw failure;
    }
    return page.data.items.map(toOrder);
  }

  async cancelOrder(orderId: string, reason: string): Promise<void> {
    try {
      await this.api.cancelOrder(orderId, { reason });
    } catch (error) {
      throw this.reportedIfCreated(toOrdersError(error, orderId), error);
    }
  }

  /**
   * Reports an `unexpected` failure the mapper created. A `TechnicalError` passed on unchanged, and a `server` failure
   * made from a 5xx, were reported (browser) or reach the logs through the caller (server) where they arose.
   */
  private reportedIfCreated(mapped: Error, original: unknown): Error {
    if (mapped !== original && mapped instanceof TechnicalError && mapped.failure === 'unexpected') {
      this.reportError.report(mapped);
    }
    return mapped;
  }
}
