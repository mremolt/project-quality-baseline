export interface CancelOrderPort {
  cancelOrder(orderId: string, reason: string): Promise<void>;
}
