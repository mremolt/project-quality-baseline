import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { CancelOrderCommand } from '../ports/in/cancel-order.use-case';
import type { CancelOrderPort } from '../ports/out/cancel-order.port';
import { CancelOrderService } from './cancel-order.service';

describe('CancelOrderService', () => {
  it('cancels the order with the trimmed reason', async () => {
    const port = mock<CancelOrderPort>();
    const service = new CancelOrderService(port);

    await service.cancelOrder(CancelOrderCommand.of({ orderId: 'o-1', reason: '  changed my mind ' }));

    expect(port.cancelOrder).toHaveBeenCalledExactlyOnceWith('o-1', 'changed my mind');
  });

  it('refuses a command with a too short reason', () => {
    expect(() => CancelOrderCommand.of({ orderId: 'o-1', reason: 'no' })).toThrow();
  });
});
