import { TechnicalError, UnauthenticatedError } from '@/platform/domain';

import { HttpProblem, readProblem } from './http-problem';

export interface SendOptions {
  readonly timeoutMs: number;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * The server mutator's exchange (NEXT-API-03): deadline combined with the caller's signal, no redirects, no
 * Next.js fetch cache (NEXT-RES-08), errors mapped. Returns `undefined` for an empty body. Node.js only:
 * `AbortSignal.any` is outside the browser set (the browser mutator uses `anySignal`).
 */
export async function sendRequest<T>(url: string, init: RequestInit, options: SendOptions): Promise<T> {
  const timeout = AbortSignal.timeout(options.timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json, application/problem+json');
  for (const [name, value] of Object.entries(options.headers)) headers.set(name, value);

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, signal, redirect: 'error', cache: 'no-store' });
  } catch (error) {
    if (init.signal?.aborted) throw error; // the caller cancelled: no technical error
    throw new TechnicalError(`request to ${url.split('?')[0] ?? ''} failed`, {
      cause: error,
      failure: timeout.aborted ? 'timeout' : 'network',
    });
  }
  if (response.status === 401) throw new UnauthenticatedError('session missing or expired');
  if (!response.ok) throw new HttpProblem(response.status, await readProblem(response));
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T; // unknown shape: the HTTP adapter parses it with the generated zod schema
}
