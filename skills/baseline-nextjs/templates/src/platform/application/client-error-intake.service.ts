import type { ClientErrorIntakeUseCase } from '../ports/in/client-error-intake.use-case';
import type { ClientErrorLogPort } from '../ports/out/client-error-log.port';
import type { ErrorReport } from '../ports/out/error-reporting.port';
import { scrub } from './scrub';

/** A path segment with a digit is taken for an id (REACT-OBS-05, as the browser's route template). */
const ID_SEGMENT = /\/[^/]*\d[^/]*/g;

/** The browser scrubs before sending, but anyone can post here: the server scrubs again (TS-SEC-06, DP-TEL-02). */
export class ClientErrorIntakeService implements ClientErrorIntakeUseCase {
  constructor(private readonly log: ClientErrorLogPort) {}

  accept(report: ErrorReport): void {
    this.log.write({
      ...report,
      message: scrub(report.message),
      stack: report.stack === undefined ? undefined : scrub(report.stack),
      route: scrub(report.route).replace(ID_SEGMENT, '/[id]'),
    });
  }
}
