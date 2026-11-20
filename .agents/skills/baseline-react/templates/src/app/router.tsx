import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

import { ordersRouteOptions } from '../features/orders/orders.routes';
import { RouteError } from '../platform';
import { HomePage, NotFoundPage } from './pages';
import { Shell } from './shell';

const rootRoute = createRootRoute({
  component: Shell,
  errorComponent: RouteError,
  notFoundComponent: NotFoundPage,
  staticData: { titleKey: 'app.notFound.title' }, // only the root matches when no page route does
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
  staticData: { titleKey: 'app.home.title' },
});

const ordersRoute = createRoute({ getParentRoute: () => rootRoute, ...ordersRouteOptions });

const routeTree = rootRoute.addChildren([homeRoute, ordersRoute]);

export const router = createRouter({ routeTree, scrollRestoration: true, defaultPreload: 'intent' });

export type AppRouter = typeof router;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
