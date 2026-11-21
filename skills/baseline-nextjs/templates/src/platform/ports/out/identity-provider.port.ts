export interface LoginChecks {
  readonly codeVerifier: string;
  readonly state: string;
  readonly nonce: string;
}

export interface AuthorizationRequest extends LoginChecks {
  readonly url: URL;
}

export interface Tokens {
  readonly subject: string;
  readonly sid: string | undefined;
  readonly accessToken: string;
  readonly accessTokenExpiresAt: number;
  readonly refreshToken: string | undefined;
  readonly idToken: string | undefined;
}

/** The IdP rejected the authorization response (state, nonce, claims, error response); not an outage. */
export class LoginRejectedError extends Error {
  override readonly name = 'LoginRejectedError';
}

/** The OIDC provider, behind openid-client 6 (NODE-BFF-02). */
export interface IdentityProvider {
  authorizationRequest(): Promise<AuthorizationRequest>;
  exchangeCode(callbackUrl: URL, checks: LoginChecks): Promise<Tokens>;
  refresh(previous: Tokens & { readonly refreshToken: string }): Promise<Tokens>;
  revoke(refreshToken: string): Promise<void>;
  endSessionUrl(idTokenHint: string | undefined): Promise<URL>;
}
