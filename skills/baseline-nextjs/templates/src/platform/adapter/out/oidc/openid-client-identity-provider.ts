import * as oidc from 'openid-client';

import type {
  AuthorizationRequest,
  IdentityProvider,
  LoginChecks,
  Tokens,
} from '../../../ports/out/identity-provider.port';

export interface OidcSettings {
  readonly redirectUri: string;
  readonly postLogoutRedirectUri: string;
  readonly scope: string;
}

type TokenResponse = oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;

function toTokens(response: TokenResponse, now: number, previous?: Tokens): Tokens {
  const claims = response.claims(); // a refresh response may come without an ID token
  const subject = claims?.sub ?? previous?.subject;
  if (!subject) throw new Error('token response without ID token');
  const sid = claims?.['sid'];
  return {
    subject,
    sid: typeof sid === 'string' ? sid : previous?.sid,
    accessToken: response.access_token,
    accessTokenExpiresAt: now + (response.expiresIn() ?? 0) * 1000,
    refreshToken: response.refresh_token ?? previous?.refreshToken, // kept unless the IdP rotates it
    idToken: response.id_token ?? previous?.idToken,
  };
}

/** openid-client 6: authorization code flow with PKCE (S256), state and nonce (NEST-SEC-45). */
export class OpenIdClientIdentityProvider implements IdentityProvider {
  constructor(
    private readonly configuration: () => Promise<oidc.Configuration>,
    private readonly settings: OidcSettings,
    private readonly now: () => number,
  ) {}

  async authorizationRequest(): Promise<AuthorizationRequest> {
    const config = await this.configuration();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.settings.redirectUri,
      scope: this.settings.scope,
      code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    return { url, codeVerifier, state, nonce };
  }

  async exchangeCode(callbackUrl: URL, checks: LoginChecks): Promise<Tokens> {
    const config = await this.configuration();
    const response = await oidc.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: checks.codeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    });
    return toTokens(response, this.now());
  }

  async refresh(previous: Tokens & { refreshToken: string }): Promise<Tokens> {
    const response = await oidc.refreshTokenGrant(await this.configuration(), previous.refreshToken);
    return toTokens(response, this.now(), previous);
  }

  async revoke(refreshToken: string): Promise<void> {
    const config = await this.configuration();
    if (config.serverMetadata().revocation_endpoint) await oidc.tokenRevocation(config, refreshToken);
  }

  async endSessionUrl(idTokenHint: string | undefined): Promise<URL> {
    const config = await this.configuration();
    if (!config.serverMetadata().end_session_endpoint) return new URL(this.settings.postLogoutRedirectUri);
    return oidc.buildEndSessionUrl(config, {
      post_logout_redirect_uri: this.settings.postLogoutRedirectUri,
      ...(idTokenHint ? { id_token_hint: idTokenHint } : {}),
    });
  }
}
