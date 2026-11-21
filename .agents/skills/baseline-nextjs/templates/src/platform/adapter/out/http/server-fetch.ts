import 'server-only';

import { markReported, TechnicalError, UnauthenticatedError } from '@/platform/domain';

import type { ReportErrorUseCase } from '../../../ports/in/report-error.use-case';
import { backendUrl } from './backend-url';
import { HttpProblem } from './http-problem';
import { sendRequest } from './send-request';

export interface ServerFetchSettings {
  readonly apiBaseUrl: string;
  /** Total deadline of one call: session lookup, token refresh and backend call (NEXT-RES-03). */
  readonly timeoutMs: number;
  /** The access token of the current request's session (token relay, NODE-BFF-01), within the call's deadline. */
  readonly accessToken: (deadline: AbortSignal) => Promise<string | undefined>;
  /** The server reporter (the platform logger): logs what this mutator creates, once (TS-ARCH-18, NEXT-OBS-10). */
  readonly reportError: ReportErrorUseCase;
}

let settings: (() => ServerFetchSettings) | undefined;

/** Called once by the platform composition; an Orval mutator is a plain function and cannot take constructor arguments. */
export function configureServerFetch(value: () => ServerFetchSettings): void {
  settings = value;
}

/**
 * Reports what this mutator creates, once, like the browser mutator (TS-ARCH-18): its `TechnicalError`s (network
 * failure, time-out, refused path) and a 5xx, with status and the backend's `traceId`. The 5xx goes on as the
 * `HttpProblem` the feature's mapper expects, marked as reported, so neither the mapper's `server` error that wraps
 * it nor `onRequestError` logs it again. 4xx, 401 and a call the caller cancelled are not reported.
 */
function reported(error: unknown, reportError: ReportErrorUseCase): unknown {
  if (error instanceof TechnicalError) {
    reportError.report(error);
  } else if (error instanceof HttpProblem && error.status >= 500) {
    reportError.report(new TechnicalError('backend call failed', { cause: error, failure: 'server' }), {
      status: error.status,
      ...(error.problem.traceId && { traceId: error.problem.traceId }),
    });
    markReported(error);
  }
  return error;
}

/** Orval mutator for server components and server actions: calls the backend directly with the relayed token. */
export async function customFetch<T>(url: string, init: RequestInit): Promise<T> {
  if (!settings) throw new Error('server fetch used before the platform composition configured it'); // a bug
  const { reportError, ...call } = settings();
  try {
    return await exchange<T>(url, init, call);
  } catch (error) {
    throw reported(error, reportError);
  }
}

async function exchange<T>(
  url: string,
  init: RequestInit,
  { apiBaseUrl, timeoutMs, accessToken }: Omit<ServerFetchSettings, 'reportError'>,
): Promise<T> {
  const target = backendUrl(url, apiBaseUrl);
  if (!target) throw new TechnicalError('backend path refused (path steering)');
  const deadline = AbortSignal.timeout(timeoutMs); // starts before the session lookup: one budget per call
  let token: string | undefined;
  try {
    token = await accessToken(init.signal ? AbortSignal.any([init.signal, deadline]) : deadline);
  } catch (error) {
    if (init.signal?.aborted || !deadline.aborted) throw error;
    throw new TechnicalError('session lookup exceeded the call deadline', { cause: error, failure: 'timeout' });
  }
  if (!token) throw new UnauthenticatedError('no session');
  return sendRequest<T>(target.href, init, { deadline, headers: { authorization: `Bearer ${token}` } });
}
