import { CacheProvider } from '@emotion/react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { Provider as StoreProvider } from 'react-redux';
import { IntlProvider } from 'use-intl';

import type { AppLocale } from '../i18n/messages';
import { MESSAGES } from '../i18n/messages';
import { createAppStore, type Platform, PlatformProvider, RootErrorBoundary } from '../platform';
import { TechnicalError } from '../platform/domain';
import { theme } from '../shared/ui/theme';
import { createEmotionCache } from './emotion-cache';
import type { AppRouter } from './router';

/** Retry only failures a second attempt can fix; business errors and server errors are final (REACT-STATE-15). */
function retryTransient(failureCount: number, error: Error): boolean {
  return failureCount < 2 && error instanceof TechnicalError && ['network', 'timeout'].includes(error.failure);
}

/** Exponential back-off with jitter (RES-RTY-03); TanStack's default delay has none. */
function retryDelayWithJitter(attempt: number): number {
  // eslint-disable-next-line sonarjs/pseudo-random -- jitter only spreads retries; nothing security-relevant
  return Math.min(1000 * 2 ** attempt, 8000) * (0.5 + Math.random() / 2);
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: retryTransient, retryDelay: retryDelayWithJitter } },
  });
}

interface AppProps {
  readonly platform: Platform;
  readonly router: AppRouter;
  readonly locale: AppLocale;
}

/** Root composition: providers in the order their consumers need them. */
export function App({ platform, router, locale }: AppProps): ReactNode {
  const [emotionCache] = useState(createEmotionCache);
  const [store] = useState(createAppStore);
  const [queryClient] = useState(createQueryClient);

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <IntlProvider
          locale={locale}
          messages={MESSAGES[locale]}
          timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
        >
          <PlatformProvider platform={platform}>
            <RootErrorBoundary>
              <StoreProvider store={store}>
                <QueryClientProvider client={queryClient}>
                  <RouterProvider router={router} />
                </QueryClientProvider>
              </StoreProvider>
            </RootErrorBoundary>
          </PlatformProvider>
        </IntlProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}
