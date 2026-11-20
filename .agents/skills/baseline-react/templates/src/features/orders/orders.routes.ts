import { lazyRouteComponent } from '@tanstack/react-router';
import { z } from 'zod';

/** Search params are untrusted input: parsed, with a fallback instead of an error page. */
const OrdersSearch = z.object({ page: z.int().nonnegative().default(0).catch(0) });

/**
 * TS-ARCH-20 for code-based TanStack Router: the app spreads these options into `createRoute` statically, because
 * the route tree must be known for typed links and search params. Everything else of the feature (page, slice,
 * adapters, composition) stays behind the dynamic `import()` and loads with the route chunk.
 */
export const ordersRouteOptions = {
  path: 'orders',
  validateSearch: OrdersSearch,
  staticData: { titleKey: 'orders.page.title' },
  component: lazyRouteComponent(() => import('./orders.composition'), 'OrdersScreen'),
} as const;
