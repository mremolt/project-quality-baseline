import type { HttpFailureDetails, ReportErrorUseCase } from '../ports/in/report-error.use-case';
import type { ErrorReportingPort } from '../ports/out/error-reporting.port';
import { scrub } from './scrub';

export interface ReportingSettings {
  readonly enabled: boolean;
  readonly environment: string;
  readonly release: string;
  readonly maxReports: number;
}

function describeError(error: unknown): { type: string; message: string; stack: string | undefined } {
  if (error instanceof Error) return { type: error.name, message: error.message, stack: error.stack };
  return { type: typeof error, message: String(error), stack: undefined };
}

/** Builds, scrubs and de-duplicates reports, then hands them to the outgoing port (REACT-OBS-02). */
export class ReportErrorService implements ReportErrorUseCase {
  private readonly sent = new Set<string>();

  constructor(
    private readonly reporting: ErrorReportingPort,
    private readonly settings: ReportingSettings,
    private readonly currentRoute: () => string,
  ) {}

  report(error: unknown, details: HttpFailureDetails = {}): void {
    if (!this.settings.enabled || this.sent.size >= this.settings.maxReports) return;
    const { type, message, stack } = describeError(error);
    const fingerprint = `${type}|${message}|${String(details.status)}`;
    if (this.sent.has(fingerprint)) return;
    this.sent.add(fingerprint);
    this.reporting.send({
      type,
      message: scrub(message),
      stack: stack === undefined ? undefined : scrub(stack),
      release: this.settings.release,
      environment: this.settings.environment,
      route: this.currentRoute(),
      status: details.status,
      traceId: details.traceId,
    });
  }
}
