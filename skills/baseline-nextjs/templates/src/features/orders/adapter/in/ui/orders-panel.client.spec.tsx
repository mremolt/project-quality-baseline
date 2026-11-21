import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { TechnicalError } from '@/platform';
import { rootReducer } from '@/platform/index.client';
import { expectNoAxeViolations, renderWithProviders } from '@/testing/render-with-providers';

import type { Order } from '../../../domain/order';
import { OrderAlreadyShipped } from '../../../domain/order-errors';
import { OrdersContext } from '../../../orders.tokens';
import { CancelOrderCommand, type CancelOrderUseCase } from '../../../ports/in/cancel-order.use-case';
import type { ListOrdersUseCase } from '../../../ports/in/list-orders.use-case';
import { OrdersPanel } from './orders-panel.client';
import { ordersViewSlice } from './orders-view.slice';

rootReducer.inject(ordersViewSlice); // as the feature composition does

const orders: readonly Order[] = [
  {
    id: 'o-1',
    number: '2026-0001',
    status: 'OPEN',
    total: { amount: '129.90', currency: 'EUR' },
    placedAt: new Date('2026-11-01T10:15:00Z'),
  },
  {
    id: 'o-2',
    number: '2026-0002',
    status: 'SHIPPED',
    total: { amount: '15.00', currency: 'EUR' },
    placedAt: new Date('2026-10-20T08:00:00Z'),
  },
];

function setup() {
  const listOrders = mock<ListOrdersUseCase>();
  const cancelOrder = mock<CancelOrderUseCase>();
  listOrders.listOrders.mockResolvedValue(orders);
  // REACT-TEST-06: an object of mocked use cases in the feature's one context
  const withUseCases = (children: ReactNode) => (
    <OrdersContext value={{ listOrders, cancelOrder }}>{children}</OrdersContext>
  );
  const view = renderWithProviders(<OrdersPanel initialOrders={orders} />, { useCases: withUseCases });
  return { ...view, listOrders, cancelOrder };
}

describe('OrdersPanel', () => {
  it('lists the orders with exact amounts and offers cancel only for open ones', async () => {
    const { container } = setup();

    const table = screen.getByRole('table', { name: 'Your orders' });
    expect(within(table).getByRole('rowheader', { name: '2026-0001' })).toBeInTheDocument();
    expect(within(table).getByText('€129.90')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel order 2026-0001' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order 2026-0002' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 orders');
    await expectNoAxeViolations(container);
  });

  it('cancels an order with a reason', async () => {
    const user = userEvent.setup();
    const { cancelOrder, listOrders } = setup();
    cancelOrder.cancelOrder.mockResolvedValue();

    await user.click(screen.getByRole('button', { name: 'Cancel order 2026-0001' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel order 2026-0001' });
    await expectNoAxeViolations(dialog);
    await user.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'changed my mind');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel order' }));

    expect(await screen.findByText('The order was cancelled.')).toBeInTheDocument();
    expect(cancelOrder.cancelOrder).toHaveBeenCalledExactlyOnceWith(
      CancelOrderCommand.of({ orderId: 'o-1', reason: 'changed my mind' }),
    );
    expect(listOrders.listOrders).toHaveBeenCalled(); // the list was invalidated in the mutation's onSuccess
  });

  it('rejects a too short reason without calling the use case', async () => {
    const user = userEvent.setup();
    const { cancelOrder } = setup();

    await user.click(screen.getByRole('button', { name: 'Cancel order 2026-0001' }));
    await user.type(await screen.findByRole('textbox', { name: 'Reason' }), 'no');
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));

    expect(await screen.findByText('Please enter a reason of 3 to 500 characters.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Reason' })).toHaveFocus(); // inputRef on the input (REACT-TEST-10)
    expect(cancelOrder.cancelOrder).not.toHaveBeenCalled();
  });

  async function submitCancel(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Cancel order 2026-0001' }));
    await user.type(await screen.findByRole('textbox', { name: 'Reason' }), 'changed my mind');
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
  }

  it('shows the business error when the order already shipped, without reporting it', async () => {
    const user = userEvent.setup();
    const { cancelOrder, reportError } = setup();
    cancelOrder.cancelOrder.mockRejectedValue(new OrderAlreadyShipped('o-1'));

    await submitCancel(user);

    expect(
      await screen.findByText('This order has already shipped and can no longer be cancelled.'),
    ).toBeInTheDocument();
    expect(reportError.report).not.toHaveBeenCalled();
  });

  it('shows the generic message for a technical error and leaves reporting to where it was created', async () => {
    const user = userEvent.setup();
    const { cancelOrder, reportError } = setup();
    cancelOrder.cancelOrder.mockRejectedValue(new TechnicalError('cancel order action failed'));

    await submitCancel(user);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(reportError.report).not.toHaveBeenCalled();
  });

  it('reports an unexpected error once (REACT-STATE-07)', async () => {
    const user = userEvent.setup();
    const { cancelOrder, reportError } = setup();
    const bug = new TypeError('a bug');
    cancelOrder.cancelOrder.mockRejectedValue(bug);

    await submitCancel(user);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(reportError.report).toHaveBeenCalledExactlyOnceWith(bug);
  });
});
