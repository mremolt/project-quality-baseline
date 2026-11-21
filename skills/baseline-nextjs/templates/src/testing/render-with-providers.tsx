import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { expect } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import { theme } from '@/app/theme';
import type { PublicConfig } from '@/platform';
import {
  type AppStore,
  makeStore,
  PublicConfigProvider,
  ReportErrorProvider,
  type ReportErrorUseCase,
} from '@/platform/index.client';

import messages from '../../messages/en.json';

const TEST_PUBLIC_CONFIG: PublicConfig = {
  environmentLabel: '',
  environmentName: 'test',
  release: 'unreleased',
  commit: 'unknown',
  requestTimeoutMs: 20_000,
  clientErrorPath: '/client-errors',
};

interface Options {
  /** Context providers that bind mocked use-case contracts (TS-TEST-01). */
  readonly useCases?: (children: ReactNode) => ReactNode;
  readonly store?: AppStore;
}

interface Rendered extends RenderResult {
  readonly store: AppStore;
  /** The mocked report-error use case behind `useReportError()` (REACT-STATE-07). */
  readonly reportError: MockProxy<ReportErrorUseCase>;
}

/** Renders like the app: theme, i18n, runtime config, error reporting, a fresh store and query client, mocked use cases. */
export function renderWithProviders(ui: ReactNode, options: Options = {}): Rendered {
  const store = options.store ?? makeStore();
  const reportError = mock<ReportErrorUseCase>();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const withUseCases = options.useCases ?? ((children: ReactNode) => children);
  const result = render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="Europe/Berlin">
      <ThemeProvider theme={theme}>
        <PublicConfigProvider value={TEST_PUBLIC_CONFIG}>
          <ReportErrorProvider value={reportError}>
            <Provider store={store}>
              <QueryClientProvider client={queryClient}>{withUseCases(ui)}</QueryClientProvider>
            </Provider>
          </ReportErrorProvider>
        </PublicConfigProvider>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
  return { ...result, store, reportError };
}

/** axe in jsdom (TS-TEST-09); contrast and target size need layout and are checked in E2E. */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const { violations } = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } },
  });
  expect(violations).toEqual([]);
}
