/** Details the platform HTTP path knows about a failed backend call. */
export interface HttpFailureDetails {
  readonly status?: number;
  readonly traceId?: string;
}

export interface ReportErrorUseCase {
  report(error: unknown, details?: HttpFailureDetails): void;
}
