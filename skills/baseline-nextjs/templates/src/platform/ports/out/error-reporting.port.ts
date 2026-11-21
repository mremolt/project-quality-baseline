/** A scrubbed error report: no URLs with ids, no query strings, no personal data (TS-SEC-06). */
export interface ErrorReport {
  readonly type: string;
  readonly message: string;
  readonly stack: string | undefined;
  readonly release: string;
  readonly environment: string;
  readonly route: string;
  readonly status: number | undefined;
  readonly traceId: string | undefined;
}

export interface ErrorReportingPort {
  send(report: ErrorReport): void;
}
