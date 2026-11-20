// Deliberate violation (TS-ARCH-20): a static import pulls the composition into the main bundle
import { lazyRouteComponent } from '@tanstack/react-router';

import { OrdersScreen } from './orders.composition';

export const ordersRouteOptions = {
  path: 'orders',
  component: lazyRouteComponent(() => Promise.resolve({ OrdersScreen }), 'OrdersScreen'),
} as const;
