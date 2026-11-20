import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../../../../../test/axe';
import { renderWithProviders } from '../../../../../../test/render-with-providers';
import { rootReducer } from '../../../../../platform';
import { TechnicalError } from '../../../../../platform/domain';
import type { Order, OrderPage } from '../../../domain/order';
import { OrderAlreadyShipped } from '../../../domain/order-errors';
import { CancelOrderContext, LoadOrdersContext } from '../../../orders.tokens';
import { CancelOrderCommand, type CancelOrderUseCase } from '../../../ports/in/cancel-order.use-case';
import type { LoadOrdersUseCase } from '../../../ports/in/load-orders.use-case';
import { ordersSlice } from './orders.slice';
import { OrdersPage } from './orders-page';

rootReducer.inject(ordersSlice);

const anOrder = (id: string, status: Order['status'] = 'OPEN'): Order => ({
  id,
  number: `A-${id}`,
  status,
  total: { amount: '129.90', currency: 'EUR' },
  createdAt: new Date('2026-11-02T10:15:00Z'),
});
const aPage = (items: readonly Order[], page = 0, totalPages = 1): OrderPage => ({
  items,
  page,
  totalPages,
  totalElements: items.length,
});

function renderPage(loadOrders = mock<LoadOrdersUseCase>(), cancelOrder = mock<CancelOrderUseCase>()) {
  const rendered = renderWithProviders(
    <LoadOrdersContext value={loadOrders}>
      <CancelOrderContext value={cancelOrder}>
        <OrdersPage />
      </CancelOrderContext>
    </LoadOrdersContext>,
    { path: 'orders', validateSearch: z.object({ page: z.int().nonnegative().default(0).catch(0) }) },
  );
  return { ...rendered, loadOrders, cancelOrder, user: userEvent.setup() };
}

describe('OrdersPage', () => {
  it('shows the orders of the first page in a labelled table', async () => {
    const loadOrders = mock<LoadOrdersUseCase>();
    loadOrders.load.mockResolvedValue(aPage([anOrder('1'), anOrder('2', 'SHIPPED')]));
    const { container } = renderPage(loadOrders);

    const table = await screen.findByRole('table', { name: 'Orders' });

    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('cell', { name: 'Shipped' })).toBeVisible();
    expect(within(table).getAllByRole('cell', { name: '€129.90' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Cancel order A-1' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Cancel order A-2' })).toBeNull();
    expect(screen.getByText('2 orders')).toBeVisible();
    expect(loadOrders.load).toHaveBeenCalledWith({ page: 0, size: 20 }, expect.any(AbortSignal));
    await expectNoAxeViolations(container);
  });

  it('says so when there are no orders', async () => {
    const loadOrders = mock<LoadOrdersUseCase>();
    loadOrders.load.mockResolvedValue(aPage([]));
    const { container } = renderPage(loadOrders);

    await screen.findByText('No orders yet.');
    expect(screen.getByRole('status')).toHaveTextContent('No orders yet.');
    await expectNoAxeViolations(container);
  });

  it('offers a retry when loading fails', async () => {
    const loadOrders = mock<LoadOrdersUseCase>();
    loadOrders.load.mockRejectedValueOnce(new TechnicalError('server')).mockResolvedValue(aPage([anOrder('1')]));
    const { container, user } = renderPage(loadOrders);

    expect(await screen.findByRole('alert')).toHaveTextContent('The orders could not be loaded.');
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('table', { name: 'Orders' })).toBeVisible();
  });

  it('cancels an order with the command built from the form and announces it', async () => {
    const loadOrders = mock<LoadOrdersUseCase>();
    const cancelOrder = mock<CancelOrderUseCase>();
    loadOrders.load.mockResolvedValue(aPage([anOrder('1')]));
    cancelOrder.cancel.mockResolvedValue(anOrder('1', 'CANCELLED'));
    const { user, announcer } = renderPage(loadOrders, cancelOrder);

    await user.click(await screen.findByRole('button', { name: 'Cancel order A-1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel order A-1' });
    await expectNoAxeViolations(dialog);
    await user.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Ordered twice');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel order' }));

    await waitFor(() => {
      expect(announcer.announce).toHaveBeenCalledWith('Order A-1 cancelled.');
    });
    expect(cancelOrder.cancel).toHaveBeenCalledWith(
      CancelOrderCommand.of({ orderId: '1', reason: 'Ordered twice' }),
      expect.any(AbortSignal),
    );
    await waitFor(() => {
      expect(loadOrders.load).toHaveBeenCalledTimes(2); // list invalidated after the command (REACT-TEST-13)
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toHaveFocus();
  });

  it('validates the reason before sending anything', async () => {
    const loadOrders = mock<LoadOrdersUseCase>();
    const cancelOrder = mock<CancelOrderUseCase>();
    loadOrders.load.mockResolvedValue(aPage([anOrder('1')]));
    const { user } = renderPage(loadOrders, cancelOrder);

    await user.click(await screen.findByRole('button', { name: 'Cancel order A-1' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'no');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel order' }));

    const reason = within(dialog).getByRole('textbox', { name: 'Reason' });
    await waitFor(() => {
      expect(reason).toBeInvalid();
    });
    // REACT-TEST-10: the error is the field's accessible description, and focus moves to the first invalid field
    expect(reason).toHaveAccessibleDescription('Enter a reason of 3 to 200 characters.');
    expect(reason).toHaveFocus();
    expect(cancelOrder.cancel).not.toHaveBeenCalled();
  });

  it('shows a business error in the dialog', async () => {
    const loadOrders = mock<LoadOrdersUseCase>();
    const cancelOrder = mock<CancelOrderUseCase>();
    loadOrders.load.mockResolvedValue(aPage([anOrder('1')]));
    cancelOrder.cancel.mockRejectedValue(new OrderAlreadyShipped('1'));
    const { user } = renderPage(loadOrders, cancelOrder);

    await user.click(await screen.findByRole('button', { name: 'Cancel order A-1' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Ordered twice');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel order' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already shipped');
  });

  it('returns focus to the trigger when the dialog is dismissed', async () => {
    const loadOrders = mock<LoadOrdersUseCase>();
    loadOrders.load.mockResolvedValue(aPage([anOrder('1')]));
    const { user } = renderPage(loadOrders);

    const trigger = await screen.findByRole('button', { name: 'Cancel order A-1' });
    await user.click(trigger);
    await user.click(await screen.findByRole('button', { name: 'Keep order' }));

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});
