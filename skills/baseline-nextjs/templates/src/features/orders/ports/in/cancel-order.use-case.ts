import { z } from 'zod';

export const CancelOrderCommandSchema = z.object({
  orderId: z.string().min(1).max(64),
  reason: z.string().trim().min(3).max(500),
});

export type CancelOrderInput = z.input<typeof CancelOrderCommandSchema>;

export interface CancelOrderCommand {
  readonly orderId: string;
  readonly reason: string;
}

export const CancelOrderCommand = {
  /** The only way to build the command (ARCH-UC-05); throws a ZodError on invalid input. */
  of(input: CancelOrderInput): CancelOrderCommand {
    return Object.freeze(CancelOrderCommandSchema.parse(input));
  },
};

export interface CancelOrderUseCase {
  /** Rejects with OrderNotFound, OrderAlreadyShipped or TechnicalError. */
  cancelOrder(command: CancelOrderCommand): Promise<void>;
}
