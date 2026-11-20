import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ErrorReportingPort } from '../ports/out/error-reporting.port';
import { ReportErrorService, type ReportingSettings } from './report-error.service';

const enabled: ReportingSettings = { enabled: true, environment: 'test', release: '1.2.3', maxReports: 2 };

function setUp(settings: ReportingSettings = enabled) {
  const port = mock<ErrorReportingPort>();
  const service = new ReportErrorService(port, settings, () => '/orders');
  return { port, service };
}

describe('ReportErrorService', () => {
  it('sends a scrubbed report with release, environment, route and HTTP details', () => {
    const { port, service } = setUp();

    service.report(new TypeError('failed for jane@example.com'), { status: 503, traceId: 't-1' });

    expect(port.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TypeError',
        message: 'failed for [email]',
        release: '1.2.3',
        environment: 'test',
        route: '/orders',
        status: 503,
        traceId: 't-1',
      }),
    );
  });

  it('sends the same error only once per page load', () => {
    const { port, service } = setUp();

    service.report(new Error('boom'));
    service.report(new Error('boom'));

    expect(port.send).toHaveBeenCalledOnce();
  });

  it('stops after the report limit', () => {
    const { port, service } = setUp();

    ['a', 'b', 'c'].forEach((message) => {
      service.report(new Error(message));
    });

    expect(port.send).toHaveBeenCalledTimes(2);
  });

  it('describes values that are not errors', () => {
    const { port, service } = setUp();

    service.report('plain string');

    expect(port.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'string', message: 'plain string' }));
  });

  it('sends nothing when reporting is disabled', () => {
    const { port, service } = setUp({ ...enabled, enabled: false });

    service.report(new Error('boom'));

    expect(port.send).not.toHaveBeenCalled();
  });
});
