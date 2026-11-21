import { TechnicalError } from '../../../domain';
import type { ReportErrorUseCase } from '../../../ports/in/report-error.use-case';
import { HttpProblem, ProblemSchema } from './http-problem';
import { withXsrfHeader } from './xsrf';

export interface HttpSettings {
  readonly timeoutMs: number;
  readonly onUnauthorized: () => void;
  readonly reportError: ReportErrorUseCase;
}

let settings: HttpSettings | undefined;

/** Called once by the platform composition before the first render; every generated client call passes through it. */
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

async function readProblem(response: Response) {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = ProblemSchema.safeParse(body);
  return parsed.success ? parsed.data : {};
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  return (await response.json()) as unknown;
}

/**
 * Orval mutator (TS-API-03): same-origin URL, XSRF header, timeout, 401 handling and reporting of the technical errors
 * it creates (server errors, network failures, time-outs, a 2xx body that is not JSON). 4xx answers become
 * `HttpProblem` for the feature's mapper; the feature adapter reports the technical errors it creates (TS-ARCH-18).
 */
export async function customFetch<T>(url: string, init: RequestInit): Promise<T> {
  if (settings === undefined) throw new Error('customFetch called before configureHttp');
  const { timeoutMs, onUnauthorized, reportError } = settings;
  const target = new URL(url, globalThis.location.origin);
  if (target.origin !== globalThis.location.origin) {
    // REACT-API-05: same-origin paths only; an absolute URL from the spec or a parameter is a contract error
    const failure = new TechnicalError('unexpected');
    reportError.report(failure);
    throw failure;
  }
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? anySignal(init.signal, timeout) : timeout;
  const headers = withXsrfHeader(new Headers(init.headers), init.method ?? 'GET', target);
  headers.set('Accept', 'application/json, application/problem+json');

  let response: Response;
  try {
    response = await fetch(target, { ...init, headers, signal, credentials: 'same-origin' });
  } catch (error) {
    if (init.signal?.aborted === true) throw error; // cancelled by the caller: not a failure
    const failure = new TechnicalError(timeout.aborted ? 'timeout' : 'network', { cause: error });
    reportError.report(failure);
    throw failure;
  }

  if (response.ok) {
    try {
      // The generated signature names the expected type; the feature adapter parses it with the generated zod schema (TS-API-05).
      return (await readBody(response)) as T;
    } catch (error) {
      const failure = new TechnicalError('malformed-response', { cause: error });
      reportError.report(failure, { status: response.status });
      throw failure;
    }
  }
  if (response.status === 401) {
    onUnauthorized();
    throw new TechnicalError('unauthorized');
  }
  const problem = await readProblem(response);
  if (response.status >= 500) {
    const failure = new TechnicalError('server');
    reportError.report(failure, { status: response.status, ...(problem.traceId && { traceId: problem.traceId }) });
    throw failure;
  }
  throw new HttpProblem(response.status, problem);
}
