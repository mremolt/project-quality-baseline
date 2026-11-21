import { type Caller, TechnicalError, UnauthenticatedError } from '@/platform';

import { OrderAlreadyShipped, OrderNotFound } from '../../../domain/order-errors';
import {
  CancelOrderCommand,
  CancelOrderCommandSchema,
  type CancelOrderUseCase,
} from '../../../ports/in/cancel-order.use-case';

export type CancelOrderErrorCode =
  'UNAUTHENTICATED' | 'INVALID_INPUT' | 'ORDER_NOT_FOUND' | 'ORDER_ALREADY_SHIPPED' | 'TECHNICAL';

export type CancelOrderActionResult =
  { readonly ok: true } | { readonly ok: false; readonly errorCode: CancelOrderErrorCode };

export interface CancelOrderDeps {
  readonly currentCaller: () => Promise<Caller | undefined>;
  readonly cancelOrder: CancelOrderUseCase;
}

function errorCodeOf(error: unknown): CancelOrderErrorCode {
  if (error instanceof OrderNotFound) return 'ORDER_NOT_FOUND';
  if (error instanceof OrderAlreadyShipped) return 'ORDER_ALREADY_SHIPPED';
  if (error instanceof UnauthenticatedError) return 'UNAUTHENTICATED';
  if (error instanceof TechnicalError) return 'TECHNICAL'; // logged once where it was created (TS-ARCH-18)
  throw error; // a programming error: onRequestError logs it (NEXT-OBS-09)
}

/**
 * The body of the cancel server action (NEXT-TEST-06): a public POST endpoint (NEXT-SEC-04). Input is untrusted and
 * parsed with the command's schema in strict mode; the caller comes from the session, never from the input; one
 * use case; expected errors become codes (NEXT-ARCH-04, NEXT-I18N-09).
 */
export async function handleCancelOrder(input: unknown, deps: CancelOrderDeps): Promise<CancelOrderActionResult> {
  const caller = await deps.currentCaller();
  if (!caller) return { ok: false, errorCode: 'UNAUTHENTICATED' };
  const parsed = CancelOrderCommandSchema.strict().safeParse(input); // unknown keys fail
  if (!parsed.success) return { ok: false, errorCode: 'INVALID_INPUT' };
  try {
    await deps.cancelOrder.cancelOrder(CancelOrderCommand.of(parsed.data));
    return { ok: true };
  } catch (error) {
    return { ok: false, errorCode: errorCodeOf(error) };
  }
}
