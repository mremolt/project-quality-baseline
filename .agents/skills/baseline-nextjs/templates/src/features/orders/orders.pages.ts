import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { createElement, type ReactNode } from 'react';

import { OrdersScreen } from './adapter/in/ui/orders-screen.server';
import { OrdersComposition } from './orders.composition';
import { ordersServerUseCases } from './orders.composition.server';

/** Page for `src/app/orders/page.tsx`: wires the server use case into the screen inside the client composition. */
export function OrdersPage(): ReactNode {
  return createElement(
    OrdersComposition,
    null,
    createElement(OrdersScreen, { listOrders: ordersServerUseCases().listOrders }),
  );
}

export async function generateOrdersMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('orders'))('title') };
}
