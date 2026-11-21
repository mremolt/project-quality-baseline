export class OrderNotFound extends Error {
  override readonly name = 'OrderNotFound';

  constructor(readonly orderId: string) {
    super(`order ${orderId} not found`);
  }
}

export class OrderAlreadyShipped extends Error {
  override readonly name = 'OrderAlreadyShipped';

  constructor(readonly orderId: string) {
    super(`order ${orderId} already shipped`);
  }
}
