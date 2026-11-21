import 'server-only';

import type { ClientErrorLogPort } from '../../../ports/out/client-error-log.port';
import type { ErrorReport } from '../../../ports/out/error-reporting.port';
import { logger } from './logger';

/** One warn line per accepted browser report; the request's trace id comes from the logger's mixin (NEXT-OBS-08). */
export class PinoClientErrorLog implements ClientErrorLogPort {
  write(report: ErrorReport): void {
    logger.warn({ clientError: report }, 'client error reported');
  }
}
