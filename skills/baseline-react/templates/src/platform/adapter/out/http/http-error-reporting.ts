import type { ErrorReport, ErrorReportingPort } from '../../../ports/out/error-reporting.port';
import { withXsrfHeader } from './xsrf';

/** Sends reports to the same-origin endpoint of the BFF (REACT-OBS-03); a failed send is dropped, never reported. */
export class HttpErrorReporting implements ErrorReportingPort {
  constructor(private readonly path: string) {}

  send(report: ErrorReport): void {
    const target = new URL(this.path, globalThis.location.origin);
    const headers = withXsrfHeader(new Headers({ 'Content-Type': 'application/json' }), 'POST', target);
    fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify(report),
      keepalive: true,
      credentials: 'same-origin',
      signal: AbortSignal.timeout(5_000),
    }).catch(() => undefined);
  }
}
