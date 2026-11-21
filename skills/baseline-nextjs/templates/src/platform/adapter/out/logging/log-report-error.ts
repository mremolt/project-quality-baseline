import 'server-only';

import type { Logger } from 'pino';

import { markReported, wasReported } from '../../../domain';
import type { HttpFailureDetails, ReportErrorUseCase } from '../../../ports/in/report-error.use-case';

/**
 * The server's `ReportErrorUseCase`: one `error` line per technical error, written by the code that created it (the
 * server mutator, a feature's HTTP adapter), with the request's trace id from the logger's mixin (NEXT-OBS-08). It
 * marks the error, so `onRequestError` skips it when it propagates (NEXT-OBS-09); an error whose cause was reported
 * is not logged again (TS-ARCH-18).
 */
export class LogReportError implements ReportErrorUseCase {
  constructor(private readonly log: Pick<Logger, 'error'>) {}

  report(error: unknown, details: HttpFailureDetails = {}): void {
    if (wasReported(error)) return;
    markReported(error);
    this.log.error({ err: error, ...details }, 'technical error');
  }
}
