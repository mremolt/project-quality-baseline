import 'server-only';

import { TechnicalError, UnauthenticatedError } from '@/platform/domain';

import { sendRequest } from './send-request';

export interface ServerFetchSettings {
  readonly apiBaseUrl: string;
  readonly timeoutMs: number;
  /** The access token of the current request's session (token relay, NEST-SEC-44). */
  readonly accessToken: () => Promise<string | undefined>;
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
  const token = await accessToken();
  if (!token) throw new UnauthenticatedError('no session');
  return sendRequest<T>(new URL(url, apiBaseUrl).href, init, {
    timeoutMs,
    headers: { authorization: `Bearer ${token}` },
  });
}
