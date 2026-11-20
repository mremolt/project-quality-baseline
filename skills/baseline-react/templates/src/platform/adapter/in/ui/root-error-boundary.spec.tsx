import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'use-intl';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { MESSAGES } from '../../../../i18n/messages';
import { ReportErrorContext } from '../../../platform.tokens';
import type { ReportErrorUseCase } from '../../../ports/in/report-error.use-case';
import { RootErrorBoundary } from './root-error-boundary';

function Broken(): never {
  throw new Error('render failed for jane@example.com');
}

describe('RootErrorBoundary (REACT-OBS-01, REACT-SEC-08)', () => {
  it('reports a render error once and shows the generic message without details', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // React logs caught render errors
    const reportError = mock<ReportErrorUseCase>();

    render(
      <IntlProvider locale="en" messages={MESSAGES.en} timeZone="UTC">
        <ReportErrorContext value={reportError}>
          <RootErrorBoundary>
            <Broken />
          </RootErrorBoundary>
        </ReportErrorContext>
      </IntlProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.queryByText(/render failed/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeVisible();
    expect(reportError.report).toHaveBeenCalledOnce();
  });
});
