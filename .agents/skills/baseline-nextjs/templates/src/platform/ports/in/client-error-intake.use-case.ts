import type { ErrorReport } from '../out/error-reporting.port';

/** Error reports the browser sends to the BFF's fixed `/client-errors` route handler (NEXT-OBS-18). */
export interface ClientErrorIntakeUseCase {
  /** Untrusted input, already shape-checked by the route handler; scrubbed again before it is written. */
  accept(report: ErrorReport): void;
}
