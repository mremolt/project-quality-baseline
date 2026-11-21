'use client';

import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { queryOptions, useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { useAppDispatch, useAppSelector } from '@/platform/index.client';
import { formatMoney } from '@/shared/ui';

import { canCancel, type Order } from '../../../domain/order';
import { useListOrders } from '../../../orders.tokens';
import type { ListOrdersUseCase } from '../../../ports/in/list-orders.use-case';
import { ordersQueryKeys } from './orders-queries';
import { orderSelected, selectOrdersView } from './orders-view.slice';

const CancelOrderForm = dynamic(() => import('./cancel-order-form.client').then((m) => m.CancelOrderForm), {
  ssr: false,
});

/** The query calls the use case, never HTTP; the cache holds domain types only. */
const ordersListQuery = (listOrders: ListOrdersUseCase) =>
  queryOptions({ queryKey: ordersQueryKeys.list(), queryFn: ({ signal }) => listOrders.listOrders(signal) });

export function OrdersPanel({ initialOrders }: { readonly initialOrders: readonly Order[] }): ReactNode {
  const t = useTranslations('orders');
  const format = useFormatter();
  const locale = useLocale();
  const listOrders = useListOrders();
  const dispatch = useAppDispatch();
  const view = useAppSelector(selectOrdersView);
  const { data: orders } = useQuery({ ...ordersListQuery(listOrders), initialData: initialOrders });
  const selected = orders.find((o) => o.id === view.selectedOrderId);

  return (
    <>
      <Typography role="status" sx={{ mb: 2 }}>
        {view.cancelStatus === 'succeeded' ? t('cancel.succeeded') : t('count', { count: orders.length })}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table aria-labelledby="orders-caption">
          <caption id="orders-caption">{t('table.caption')}</caption>
          <TableHead>
            <TableRow>
              <TableCell scope="col">{t('table.number')}</TableCell>
              <TableCell scope="col">{t('table.placedAt')}</TableCell>
              <TableCell scope="col">{t('table.status')}</TableCell>
              <TableCell scope="col" align="right">
                {t('table.total')}
              </TableCell>
              <TableCell scope="col">{t('table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell scope="row" component="th">
                  {order.number}
                </TableCell>
                <TableCell>{format.dateTime(order.placedAt, { dateStyle: 'medium' })}</TableCell>
                <TableCell>{t(`status.${order.status}`)}</TableCell>
                <TableCell align="right">{formatMoney(locale, order.total)}</TableCell>
                <TableCell>
                  {canCancel(order) && (
                    <Button size="small" onClick={() => dispatch(orderSelected(order.id))}>
                      {t('cancel.open', { number: order.number })}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {selected && <CancelOrderForm key={selected.id} order={selected} />}
    </>
  );
}
