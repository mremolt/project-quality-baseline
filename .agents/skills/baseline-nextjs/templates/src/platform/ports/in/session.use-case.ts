import type { Caller } from '../../domain';

export interface LoginStart {
  /** Id of the pre-login record, the value of the `__Host-login` cookie; never a session id. */
  readonly loginId: string;
  readonly redirectTo: URL;
  /** Lifetime of the pre-login record; the login cookie gets the same Max-Age. */
  readonly ttlSeconds: number;
}

export interface LoginResult {
  readonly sessionId: string;
  readonly xsrfToken: string;
  readonly returnTo: string;
}

export interface ResolvedSession {
  readonly caller: Caller | undefined;
  readonly xsrfToken: string;
}

/**
 * BFF session use cases (NODE-BFF-01..08), called by the auth route handlers, the proxy and the server mutator.
 * `deadline` is the total deadline of the calling request (NEXT-RES-03): the call rejects with its reason once it fires.
 */
export interface SessionUseCase {
  /** Creates a pre-login record only; a live session stays as it is until the callback succeeds. */
  startLogin(returnTo: string): Promise<LoginStart>;
  /** Consumes the pre-login record, creates a session under a new id and ends `currentSessionId`, if any. */
  completeLogin(
    loginId: string | undefined,
    callbackUrl: URL,
    currentSessionId: string | undefined,
  ): Promise<LoginResult>;
  /** Undefined when the session is missing, idle or past its absolute lifetime. */
  resolve(sessionId: string | undefined, deadline?: AbortSignal): Promise<ResolvedSession | undefined>;
  /** A valid access token for the token relay, refreshed shortly before expiry (one refresh per session at a time). */
  accessToken(sessionId: string | undefined, deadline?: AbortSignal): Promise<string | undefined>;
  /** The IdP's end-session URL; undefined when the IdP cannot be reached, the local session is ended anyway. */
  logout(sessionId: string | undefined): Promise<URL | undefined>;
}

export class LoginFailedError extends Error {
  override readonly name = 'LoginFailedError';
}
