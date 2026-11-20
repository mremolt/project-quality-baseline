import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ordersRouteOptions } from './orders.routes';

/** REACT-TEST-14: the real route options with the lazy component replaced, so the feature chunk is not loaded. */
function setUp(url: string) {
  const rootRoute = createRootRoute({ staticData: { titleKey: 'app.notFound.title' } });
  const ordersRoute = createRoute({
    getParentRoute: () => rootRoute,
    ...ordersRouteOptions,
    component: () => <h1>Orders</h1>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([ordersRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe('orders route options', () => {
  it('reads a valid page from the search params', async () => {
    const router = setUp('/orders?page=2');
    await screen.findByRole('heading', { name: 'Orders' });

    expect(router.state.location.search).toEqual({ page: 2 });
    expect(router.state.matches.at(-1)?.staticData.titleKey).toBe('orders.page.title');
  });

  it('falls back to the first page for a hand-edited search param (REACT-ARCH-19)', async () => {
    const router = setUp('/orders?page=-3');
    await screen.findByRole('heading', { name: 'Orders' });

    expect(router.state.matches.at(-1)?.search).toEqual({ page: 0 });
  });
});
