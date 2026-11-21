'use client';

import type { ReactNode } from 'react';

import { rootReducer } from '@/platform/index.client';

import { ordersViewSlice } from './adapter/in/ui/orders-view.slice';
import { OrdersApiProvider } from './orders.api';

rootReducer.inject(ordersViewSlice); // lazily, when the feature's client code loads

/** Client composition of the feature's pages: the slice, and the use cases from the published API provider. */
export function OrdersComposition({ children }: { readonly children: ReactNode }): ReactNode {
  return <OrdersApiProvider>{children}</OrdersApiProvider>;
}
