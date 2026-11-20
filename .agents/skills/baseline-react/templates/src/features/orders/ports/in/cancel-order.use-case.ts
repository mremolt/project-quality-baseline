import { z } from 'zod';

import type { Order } from '../../domain/order';

/** One schema for the command and the form (TS-ARCH-06). */
export const CancelOrderSchema = z
  .object({
    orderId: z.string().min(1),
    reason: z.string().trim().min(3).max(200),
  })
  .brand<'CancelOrderCommand'>();

export type CancelOrderCommand = Readonly<z.output<typeof CancelOrderSchema>>;

export const CancelOrderCommand = {
  of(input: z.input<typeof CancelOrderSchema>): CancelOrderCommand {
    return Object.freeze(CancelOrderSchema.parse(input));
  },
};

export interface CancelOrderUseCase {
  cancel(command: CancelOrderCommand, signal?: AbortSignal): Promise<Order>;
}
