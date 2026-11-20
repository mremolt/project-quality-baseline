import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { type ReactNode, useRef, useState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'use-intl';

import { useAppDispatch, useAppSelector } from '../../../../../platform';
import { useAnnouncer } from '../../../../../shared/ui/a11y/announcer';
import { formatMoney } from '../../../../../shared/ui/format/money';
import { EmptyState } from '../../../../../shared/ui/states/empty-state';
import { ErrorState } from '../../../../../shared/ui/states/error-state';
import { LoadingState } from '../../../../../shared/ui/states/loading-state';
import { canBeCancelled, hasNextPage, hasPreviousPage, type Order, type OrderPage } from '../../../domain/order';
import { useCancelOrderUseCase } from '../../../orders.tokens';
import type { CancelOrderCommand } from '../../../ports/in/cancel-order.use-case';
import { CancelOrderDialog } from './cancel-order-dialog';
import { ordersKeys, useOrdersPage } from './orders.queries';
import { cancelDismissed, cancelOrder, cancelRequested, selectOrdersView } from './orders.slice';

const ordersRoute = getRouteApi('/orders');

function OrdersTable({
  page,
  onCancel,
}: {
  readonly page: OrderPage;
  readonly onCancel: (order: Order, trigger: HTMLElement) => void;
}) {
  const t = useTranslations('orders');
  const format = useFormatter();
  const locale = useLocale();
  return (
    <TableContainer component={Paper} role="region" aria-label={t('table.label')} tabIndex={0}>
      <Table aria-label={t('table.label')}>
        <TableHead>
          <TableRow>
            <TableCell>{t('table.number')}</TableCell>
            <TableCell>{t('table.created')}</TableCell>
            <TableCell>{t('table.status')}</TableCell>
            <TableCell align="right">{t('table.total')}</TableCell>
            <TableCell>{t('table.actions')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {page.items.map((order) => (
            <TableRow key={order.id}>
              <TableCell component="th" scope="row">
                {order.number}
              </TableCell>
              <TableCell>{format.dateTime(order.createdAt, { dateStyle: 'medium' })}</TableCell>
              <TableCell>{t(`status.${order.status}`)}</TableCell>
              <TableCell align="right">{formatMoney(locale, order.total)}</TableCell>
              <TableCell>
                {canBeCancelled(order) && (
                  <Button
                    onClick={(event) => {
                      onCancel(order, event.currentTarget);
                    }}
                  >
                    {t('cancel.open', { number: order.number })}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function OrdersPage(): ReactNode {
  const t = useTranslations('orders');
  const { page } = ordersRoute.useSearch();
  const navigate = ordersRoute.useNavigate();
  const orders = useOrdersPage(page);
  const view = useAppSelector(selectOrdersView);
  const dispatch = useAppDispatch();
  const cancelUseCase = useCancelOrderUseCase();
  const queryClient = useQueryClient();
  const announcer = useAnnouncer();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [dialogOrder, setDialogOrder] = useState<Order | null>(null);

  const openCancel = (order: Order, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setDialogOrder(order);
    dispatch(cancelRequested(order.id));
  };

  const submitCancel = async (command: CancelOrderCommand) => {
    const result = await dispatch(cancelOrder({ useCase: cancelUseCase, command }));
    if (cancelOrder.fulfilled.match(result) && dialogOrder) {
      announcer.announce(t('cancel.done', { number: dialogOrder.number }));
      await queryClient.invalidateQueries({ queryKey: ordersKeys.all });
    }
  };

  const restoreFocus = () => {
    const trigger = triggerRef.current;
    const target = view.cancelStatus !== 'succeeded' && trigger?.isConnected ? trigger : headingRef.current;
    target?.focus();
    setDialogOrder(null);
  };

  const goToPage = (next: number) => {
    void navigate({ search: { page: next } });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h4" component="h1" tabIndex={-1} ref={headingRef}>
        {t('page.title')}
      </Typography>
      {orders.isPending && <LoadingState label={t('loading')} />}
      {orders.isError && (
        <ErrorState message={t('loadError')} retryLabel={t('retry')} onRetry={() => void orders.refetch()} />
      )}
      {orders.data?.items.length === 0 && <EmptyState message={t('empty')} />}
      {orders.data && orders.data.items.length > 0 && (
        <>
          <Typography>{t('count', { count: orders.data.totalElements })}</Typography>
          <OrdersTable page={orders.data} onCancel={openCancel} />
          <Box component="nav" aria-label={t('paging.label')} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              disabled={!hasPreviousPage(orders.data)}
              onClick={() => {
                goToPage(page - 1);
              }}
            >
              {t('paging.previous')}
            </Button>
            <Typography>{t('paging.position', { page: page + 1, pages: orders.data.totalPages })}</Typography>
            <Button
              disabled={!hasNextPage(orders.data)}
              onClick={() => {
                goToPage(page + 1);
              }}
            >
              {t('paging.next')}
            </Button>
          </Box>
        </>
      )}
      <CancelOrderDialog
        order={dialogOrder}
        open={view.cancelOrderId !== null}
        pending={view.cancelStatus === 'pending'}
        errorKey={view.cancelError}
        onSubmit={(command) => void submitCancel(command)}
        onDismiss={() => dispatch(cancelDismissed())}
        onExited={restoreFocus}
      />
    </Box>
  );
}
