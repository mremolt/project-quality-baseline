import type { Caller } from '../../domain';

export interface LoginStart {
  readonly sessionId: string;
  readonly redirectTo: URL;
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

/** BFF session use cases (NEST-SEC-44..50), called by the auth route handlers, the proxy and the server mutator. */
export interface SessionUseCase {
  startLogin(returnTo: string): Promise<LoginStart>;
  completeLogin(sessionId: string | undefined, callbackUrl: URL): Promise<LoginResult>;
  /** Undefined when the session is missing, idle or past its absolute lifetime. */
  resolve(sessionId: string | undefined): Promise<ResolvedSession | undefined>;
  /** A valid access token for the token relay, refreshed shortly before expiry; undefined without a user. */
  accessToken(sessionId: string | undefined): Promise<string | undefined>;
  logout(sessionId: string | undefined): Promise<URL>;
}

export class LoginFailedError extends Error {
  override readonly name = 'LoginFailedError';
}
