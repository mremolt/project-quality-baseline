import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider as StoreProvider } from 'react-redux';
import { IntlProvider } from 'use-intl';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { z } from 'zod';

import { MESSAGES } from '../src/i18n/messages';
import { type AppStore, createAppStore } from '../src/platform';
import { type Announcer, AnnouncerContext } from '../src/shared/ui/a11y/announcer';
import { theme } from '../src/shared/ui/theme';

interface RenderOptions {
  /** Route path the screen is mounted at, e.g. `orders` for `getRouteApi('/orders')`. */
  readonly path: string;
  readonly url?: string;
  readonly validateSearch?: z.ZodType<Record<string, unknown>>;
}

interface Rendered extends RenderResult {
  readonly store: AppStore;
  readonly queryClient: QueryClient;
  readonly announcer: MockProxy<Announcer>;
}

/**
 * Renders a screen the way the app does, with a fresh store and QueryClient, the theme, the source-locale
 * catalog (TEST-I18N-01) and a memory router. The caller wraps the screen in its feature's contexts with mocked
 * use-case contracts.
 */
export function renderWithProviders(
  screen: ReactNode,
  { path, url = `/${path}`, validateSearch }: RenderOptions,
): Rendered {
  const store = createAppStore();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const announcer = mock<Announcer>();
  const rootRoute = createRootRoute({ staticData: { titleKey: 'app.notFound.title' } });
  const screenRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    staticData: { titleKey: 'app.notFound.title' },
    ...(validateSearch && { validateSearch }),
    component: () => screen,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([screenRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });

  const result: RenderResult = render(
    <ThemeProvider theme={theme}>
      <IntlProvider locale="en" messages={MESSAGES.en} timeZone="UTC">
        <StoreProvider store={store}>
          <QueryClientProvider client={queryClient}>
            <AnnouncerContext value={announcer}>
              <RouterProvider router={router} />
            </AnnouncerContext>
          </QueryClientProvider>
        </StoreProvider>
      </IntlProvider>
    </ThemeProvider>,
  );
  return { ...result, store, queryClient, announcer };
}
