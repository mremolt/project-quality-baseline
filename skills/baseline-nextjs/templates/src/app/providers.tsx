'use client';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';

import { type PublicConfig, TechnicalError } from '@/platform';
import {
  configureHttp,
  HttpErrorReporting,
  listenForGlobalErrors,
  PublicConfigProvider,
  ReportErrorProvider,
  ReportErrorService,
  type ReportErrorUseCase,
  StoreProvider,
} from '@/platform/index.client';

import { reducedMotionTheme, theme } from './theme';

const MAX_QUERY_RETRIES = 2;

/** REACT-STATE-15: retry only transient technical failures; the HTTP mutators never retry (RES-RTY-04). */
function retryTransient(failureCount: number, error: unknown): boolean {
  return (
    failureCount < MAX_QUERY_RETRIES &&
    error instanceof TechnicalError &&
    (error.failure === 'network' || error.failure === 'timeout')
  );
}

/** Exponential backoff with jitter (RES-RTY-03); TanStack's default has none. */
function retryDelayWithJitter(attempt: number): number {
  // eslint-disable-next-line sonarjs/pseudo-random -- jitter for retry timing, not security-relevant
  return Math.min(1000 * 2 ** attempt, 8000) * (0.5 + Math.random() / 2);
}

/** The route template of a report, never the URL with ids (REACT-OBS-05, DP-TEL-02; NEXT-OBS-16 to verify). */
function currentRoute(): string {
  return globalThis.location.pathname.replace(/\/[^/]*\d[^/]*/g, '/[id]');
}

/** Browser HTTP stack and error reporting, set up once before any child renders (NEXT-API-05). */
function startBrowserPlatform(config: PublicConfig): ReportErrorUseCase {
  const reportError = new ReportErrorService(
    new HttpErrorReporting(config.clientErrorPath), // the BFF's own intake, logged there (NEXT-OBS-18)
    { enabled: true, environment: config.environmentName, release: config.release, maxReports: 20 },
    currentRoute,
  );
  configureHttp({
    timeoutMs: config.requestTimeoutMs,
    onUnauthorized: () => {
      const returnTo = `${globalThis.location.pathname}${globalThis.location.search}`;
      // a full load: /auth/login is a route handler that redirects to the IdP, not a page the router can push
      const login = new URL('/auth/login', globalThis.location.origin);
      login.searchParams.set('returnTo', returnTo);
      globalThis.location.assign(login);
    },
    reportError,
  });
  return reportError;
}

interface ProvidersProps {
  readonly nonce: string | undefined;
  readonly publicConfig: PublicConfig;
  readonly children: ReactNode;
}

/** Root client providers: Emotion cache with the CSP nonce, theme, public config, reporting, Redux store, query cache. */
export function Providers({ nonce, publicConfig, children }: ProvidersProps): ReactNode {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [reportError] = useState(() => startBrowserPlatform(publicConfig));
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // staleTime: server-rendered `initialData` (NEXT-ARCH-16) is fresh; 0 would refetch it right after hydration
          queries: { staleTime: 30_000, retry: retryTransient, retryDelay: retryDelayWithJitter },
        },
      }),
  );
  useEffect(() => listenForGlobalErrors(reportError), [reportError]); // REACT-OBS-01, browser only
  return (
    <AppRouterCacheProvider options={{ key: 'mui', ...(nonce ? { nonce } : {}) }}>
      <ThemeProvider theme={reducedMotion ? reducedMotionTheme : theme}>
        <CssBaseline />
        <PublicConfigProvider value={publicConfig}>
          <ReportErrorProvider value={reportError}>
            <StoreProvider>
              <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            </StoreProvider>
          </ReportErrorProvider>
        </PublicConfigProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
