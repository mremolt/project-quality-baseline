export class OrderAlreadyShipped extends Error {
  override readonly name = 'OrderAlreadyShipped';

  constructor(readonly orderId: string) {
    super(`Order ${orderId} has already shipped`);
  }
}

export class OrderNotFound extends Error {
  override readonly name = 'OrderNotFound';

  constructor(readonly orderId: string) {
    super(`Order ${orderId} not found`);
  }
}

export interface FieldError {
  readonly field: string;
  readonly code: string;
}

/** The backend rejected the command's input (400); keeps the field codes. */
export class CancelOrderRejected extends Error {
  override readonly name = 'CancelOrderRejected';

  constructor(readonly fieldErrors: readonly FieldError[]) {
    super('Cancel order rejected');
  }
}
