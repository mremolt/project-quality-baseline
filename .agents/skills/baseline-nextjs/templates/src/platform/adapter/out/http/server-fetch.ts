import 'server-only';

import { TechnicalError, UnauthenticatedError } from '@/platform/domain';

import { backendUrl } from './backend-url';
import { sendRequest } from './send-request';

export interface ServerFetchSettings {
  readonly apiBaseUrl: string;
  /** Total deadline of one call: session lookup, token refresh and backend call (NEXT-RES-03). */
  readonly timeoutMs: number;
  /** The access token of the current request's session (token relay, NODE-BFF-01), within the call's deadline. */
  readonly accessToken: (deadline: AbortSignal) => Promise<string | undefined>;
}

let settings: (() => ServerFetchSettings) | undefined;

/** Called once by the platform composition; an Orval mutator is a plain function and cannot take constructor arguments. */
export function configureServerFetch(value: () => ServerFetchSettings): void {
  settings = value;
}

/** Orval mutator for server components and server actions: calls the backend directly with the relayed token. */
export async function customFetch<T>(url: string, init: RequestInit): Promise<T> {
  if (!settings) throw new TechnicalError('server fetch used before the platform composition configured it');
  const { apiBaseUrl, timeoutMs, accessToken } = settings();
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
