import Typography from '@mui/material/Typography';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { UnauthenticatedError } from '@/platform';

import type { Order } from '../../../domain/order';
import type { ListOrdersUseCase } from '../../../ports/in/list-orders.use-case';
import { OrdersPanel } from './orders-panel.client';

async function loadOrders(listOrders: ListOrdersUseCase): Promise<readonly Order[]> {
  try {
    return await listOrders.listOrders();
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect('/auth/login?returnTo=/orders');
    throw error;
  }
}

/** Server-rendered orders screen: the first page of orders comes with the HTML; the panel takes over in the browser. */
export async function OrdersScreen({ listOrders }: { readonly listOrders: ListOrdersUseCase }): Promise<ReactNode> {
  const [t, orders] = await Promise.all([getTranslations('orders'), loadOrders(listOrders)]);
  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('title')}
      </Typography>
      <OrdersPanel initialOrders={orders} />
    </>
  );
}
