import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { OrderAlreadyShipped } from '../domain/order-errors';
import { CancelOrderCommand } from '../ports/in/cancel-order.use-case';
import type { CancelOrderPort } from '../ports/out/cancel-order.port';
import { CancelOrderService } from './cancel-order.service';

describe('CancelOrderService', () => {
  const command = CancelOrderCommand.of({ orderId: 'o-1', reason: 'Ordered twice' });

  it('cancels the order through the port', async () => {
    const port = mock<CancelOrderPort>();

    await new CancelOrderService(port).cancel(command);

    expect(port.cancelOrder).toHaveBeenCalledWith(command, undefined);
  });

  it('passes business errors on unchanged', async () => {
    const port = mock<CancelOrderPort>();
    port.cancelOrder.mockRejectedValue(new OrderAlreadyShipped('o-1'));

    await expect(new CancelOrderService(port).cancel(command)).rejects.toBeInstanceOf(OrderAlreadyShipped);
  });
});

describe('CancelOrderCommand', () => {
  it('trims the reason and freezes the command', () => {
    const created = CancelOrderCommand.of({ orderId: 'o-1', reason: '  Ordered twice ' });

    expect(created.reason).toBe('Ordered twice');
    expect(Object.isFrozen(created)).toBe(true);
  });

  it('rejects a reason that is too short', () => {
    expect(() => CancelOrderCommand.of({ orderId: 'o-1', reason: 'no' })).toThrow();
  });
});
