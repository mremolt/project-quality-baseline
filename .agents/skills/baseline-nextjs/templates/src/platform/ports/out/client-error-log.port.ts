import type { ErrorReport } from './error-reporting.port';

/** Where accepted browser error reports go: the server log (NEXT-OBS-07, NEXT-OBS-18). */
export interface ClientErrorLogPort {
  write(report: ErrorReport): void;
}
