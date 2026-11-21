import 'server-only';

import type { Instrumentation } from 'next';
import type { Logger } from 'pino';

import { wasReported } from '../../../domain';

type OnRequestErrorArgs = Parameters<Instrumentation.onRequestError>;

/**
 * The body of `onRequestError` (NEXT-OBS-09): one `error` line per error Next.js caught, with the route template and
 * the path without its query string. An error whose creator already logged it through the server reporter, or whose
 * cause was logged, is skipped, so a server-rendered technical failure is logged once (TS-ARCH-18).
 */
export function createRequestErrorLog(log: Pick<Logger, 'error'>) {
  return (error: unknown, request: OnRequestErrorArgs[1], context: OnRequestErrorArgs[2]): void => {
    if (wasReported(error)) return;
    log.error(
      {
        err: error,
        method: request.method,
        path: request.path.split('?')[0],
        routePath: context.routePath,
        routeType: context.routeType,
      },
      'request failed',
    );
  };
}
