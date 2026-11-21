import { describe, expect, it, vi } from 'vitest';

import { markReported, TechnicalError, wasReported } from '../../../domain';
import { LogReportError } from './log-report-error';

function setUp() {
  const log = { error: vi.fn() };
  return { log, reporter: new LogReportError(log) };
}

describe('LogReportError (the server reporter, NEXT-OBS-09/10)', () => {
  it('logs a technical error once at error level, with the HTTP details, and marks it reported', () => {
    const { log, reporter } = setUp();
    const error = new TechnicalError('orders API failed', { failure: 'server' });

    reporter.report(error, { status: 503, traceId: 't-1' });

    expect(log.error).toHaveBeenCalledExactlyOnceWith({ err: error, status: 503, traceId: 't-1' }, 'technical error');
    expect(wasReported(error)).toBe(true);
  });

  it('logs the same error only once', () => {
    const { log, reporter } = setUp();
    const error = new TechnicalError('down');

    reporter.report(error);
    reporter.report(error);

    expect(log.error).toHaveBeenCalledOnce();
  });

  it('does not log an error whose cause was reported already', () => {
    const { log, reporter } = setUp();
    const cause = new Error('backend answered 503');
    markReported(cause);

    reporter.report(new TechnicalError('orders API failed', { cause, failure: 'server' }));

    expect(log.error).not.toHaveBeenCalled();
  });
});
