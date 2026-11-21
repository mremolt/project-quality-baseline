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

/** The OIDC provider, behind openid-client 6 (NEST-SEC-45). */
export interface IdentityProvider {
  authorizationRequest(): Promise<AuthorizationRequest>;
  exchangeCode(callbackUrl: URL, checks: LoginChecks): Promise<Tokens>;
  refresh(previous: Tokens & { readonly refreshToken: string }): Promise<Tokens>;
  revoke(refreshToken: string): Promise<void>;
  endSessionUrl(idTokenHint: string | undefined): Promise<URL>;
}
