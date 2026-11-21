import { describe, expect, it, vi } from 'vitest';

import { markReported, TechnicalError } from '../../../domain';
import { createRequestErrorLog } from './request-error-log';

const request = { method: 'GET', path: '/orders?page=2', headers: {} };
const context = {
  routerKind: 'App Router',
  routePath: '/orders',
  routeType: 'render',
  renderSource: 'react-server-components',
  revalidateReason: undefined,
} as const;

function setUp() {
  const log = { error: vi.fn() };
  return { log, logRequestError: createRequestErrorLog(log) };
}

describe('the onRequestError log (NEXT-OBS-09)', () => {
  it('logs an unexpected error once, with the route template and the path without its query', () => {
    const { log, logRequestError } = setUp();
    const error = new TypeError('bug');

    logRequestError(error, request, context);

    expect(log.error).toHaveBeenCalledExactlyOnceWith(
      { err: error, method: 'GET', path: '/orders', routePath: '/orders', routeType: 'render' },
      'request failed',
    );
  });

  it('skips a technical error its creator reported already (TS-ARCH-18)', () => {
    const { log, logRequestError } = setUp();
    const error = new TechnicalError('orders API answered with a malformed body', { failure: 'malformed-response' });
    markReported(error);

    logRequestError(error, request, context);

    expect(log.error).not.toHaveBeenCalled();
  });

  it('skips an error whose cause was reported already', () => {
    const { log, logRequestError } = setUp();
    const problem = new Error('HTTP 503');
    markReported(problem);

    logRequestError(new TechnicalError('orders API failed', { cause: problem, failure: 'server' }), request, context);

    expect(log.error).not.toHaveBeenCalled();
  });
});
