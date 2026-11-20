import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'use-intl';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { MESSAGES } from '../../../../i18n/messages';
import { RouteChangeHandler } from './route-change-handler';

function Page({ title }: { readonly title: string }) {
  return <h1 tabIndex={-1}>{title}</h1>;
}

function setUp(url: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <main tabIndex={-1}>
          <Outlet />
        </main>
        <RouteChangeHandler />
      </>
    ),
    staticData: { titleKey: 'app.notFound.title' },
  });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <Page title="Home" />,
    staticData: { titleKey: 'app.home.title' },
  });
  const ordersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'orders',
    validateSearch: z.object({ page: z.int().nonnegative().default(0).catch(0) }),
    component: () => <Page title="Orders" />,
    staticData: { titleKey: 'orders.page.title' },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, ordersRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(
    <IntlProvider locale="en" messages={MESSAGES.en} timeZone="UTC">
      <RouterProvider router={router} />
    </IntlProvider>,
  );
  return router;
}

describe('RouteChangeHandler (REACT-TEST-15, UI-16, A11Y-21)', () => {
  it('sets the title on every navigation and moves focus only when the path changes', async () => {
    const router = setUp('/');
    await screen.findByRole('heading', { name: 'Home' });
    await waitFor(() => {
      expect(document.title).toBe('Home | Shop');
    });
    expect(screen.getByRole('heading', { name: 'Home' })).not.toHaveFocus(); // first load keeps focus

    await act(() => router.navigate({ to: '/orders', search: { page: 0 } }));
    expect(document.title).toBe('Orders | Shop');
    expect(screen.getByRole('heading', { name: 'Orders' })).toHaveFocus();

    screen.getByRole('main').focus();
    await act(() => router.navigate({ to: '/orders', search: { page: 2 } }));
    expect(screen.getByRole('main')).toHaveFocus(); // query-only change: focus stays

    act(() => {
      router.history.go(-2);
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Home' })).toHaveFocus();
    });
    expect(document.title).toBe('Home | Shop');
  });
});
