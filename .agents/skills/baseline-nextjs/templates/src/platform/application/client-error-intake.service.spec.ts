import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ClientErrorLogPort } from '../ports/out/client-error-log.port';
import type { ErrorReport } from '../ports/out/error-reporting.port';
import { ClientErrorIntakeService } from './client-error-intake.service';

const report: ErrorReport = {
  type: 'TypeError',
  message: 'failed for jane@example.com at https://shop.test/orders?customer=42',
  stack: 'TypeError: x\n    at https://shop.test/_next/static/chunks/a.js?token=eyJhbGciOiJIUzI1NiJ9abcdefgh:1:2',
  release: '1.2.3',
  environment: 'prod',
  route: '/orders/2026-0001',
  status: 503,
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
};

describe('ClientErrorIntakeService (NEXT-OBS-18)', () => {
  it('scrubs the untrusted report again before it reaches the log', () => {
    const log = mock<ClientErrorLogPort>();

    new ClientErrorIntakeService(log).accept(report);

    expect(log.write).toHaveBeenCalledWith({
      ...report,
      message: 'failed for [email] at https://shop.test/orders',
      stack: 'TypeError: x\n    at https://shop.test/_next/static/chunks/a.js',
      route: '/orders/[id]',
    });
  });

  it('keeps a report without stack', () => {
    const log = mock<ClientErrorLogPort>();

    new ClientErrorIntakeService(log).accept({ ...report, stack: undefined, route: '/orders' });

    expect(log.write).toHaveBeenCalledWith(expect.objectContaining({ stack: undefined, route: '/orders' }));
  });
});
