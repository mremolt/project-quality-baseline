import { TechnicalError, UnauthenticatedError } from '../../../domain';
import type { ReportErrorUseCase } from '../../../ports/in/report-error.use-case';
import { HttpProblem, readProblem } from './http-problem';
import { withXsrfHeader } from './xsrf';

export interface HttpSettings {
  readonly timeoutMs: number;
  readonly onUnauthorized: () => void;
  readonly reportError: ReportErrorUseCase;
}

let settings: HttpSettings | undefined;

/** Called once by the root client providers before any child renders (NEXT-API-05). */
export function configureHttp(next: HttpSettings): void {
  settings = next;
}

/**
 * Combines the caller's signal with the time-out (REACT-API-05). `AbortSignal.any` needs Firefox 124 / Safari 17.4,
 * beyond the TS-TOOL-02 browser set, and the `DOM` lib does not catch it.
 */
export function anySignal(...signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener(
      'abort',
      () => {
        controller.abort(signal.reason);
      },
      { once: true, signal: controller.signal },
    );
  }
  return controller.signal;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new TechnicalError('malformed response', { cause: error, failure: 'malformed-response' });
  }
}

/**
 * Orval mutator for the browser (NEXT-API-05, REACT-API-05): same-origin calls to the BFF's `/api` proxy, which
 * relays the user's access token; XSRF header on mutating calls, time-out, 401 handling, reporting of server
 * errors, network failures and time-outs. 4xx answers become `HttpProblem` for the feature's mapper.
 */
export async function customFetch<T>(url: string, init: RequestInit): Promise<T> {
  if (settings === undefined) throw new Error('customFetch called before configureHttp');
  const { timeoutMs, onUnauthorized, reportError } = settings;
  const target = new URL(url, globalThis.location.origin);
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? anySignal(init.signal, timeout) : timeout;
  const headers = withXsrfHeader(new Headers(init.headers), init.method ?? 'GET', target);
  headers.set('Accept', 'application/json, application/problem+json');

  let response: Response;
  try {
    response = await fetch(target, { ...init, headers, signal, credentials: 'same-origin' });
  } catch (error) {
    if (init.signal?.aborted === true) throw error; // cancelled by the caller: not a failure
    const failure = new TechnicalError(timeout.aborted ? 'timeout' : 'network', {
      cause: error,
      failure: timeout.aborted ? 'timeout' : 'network',
    });
    reportError.report(failure);
    throw failure;
  }

  if (response.ok) return (await readBody(response)) as T; // the feature adapter parses it (TS-API-05)
  if (response.status === 401) {
    onUnauthorized();
    throw new UnauthenticatedError('session missing or expired');
  }
  const problem = await readProblem(response);
  if (response.status >= 500) {
    reportError.report(new TechnicalError('server', { failure: 'server' }), {
      status: response.status,
      ...(problem.traceId && { traceId: problem.traceId }),
    });
  }
  throw new HttpProblem(response.status, problem);
}
