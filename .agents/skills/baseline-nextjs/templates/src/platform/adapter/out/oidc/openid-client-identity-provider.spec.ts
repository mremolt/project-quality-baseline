import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import * as oidc from 'openid-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { OpenIdClientIdentityProvider } from './openid-client-identity-provider';

const ISSUER = 'https://idp.test';
const NOW_S = 1_800_000_000;

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
/** The code flow takes the ID token from the token endpoint over TLS; openid-client checks its claims, not its signature. */
const idToken = (claims: object) =>
  `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({ iss: ISSUER, aud: 'shop', iat: NOW_S, exp: NOW_S + 300, ...claims })}.c2ln`;

describe('OpenIdClientIdentityProvider (IdP stubbed with MSW)', () => {
  const server = setupServer();
  const configuration = new oidc.Configuration(
    {
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      end_session_endpoint: `${ISSUER}/logout`,
      revocation_endpoint: `${ISSUER}/revoke`,
    },
    'shop',
    'client-secret-0123456789',
  );
  const idp = new OpenIdClientIdentityProvider(
    () => Promise.resolve(configuration),
    {
      redirectUri: 'https://shop.test/auth/callback',
      postLogoutRedirectUri: 'https://shop.test/',
      scope: 'openid profile',
    },
    () => NOW_S * 1000,
  );

  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });

  it('builds an authorization request with PKCE S256, state and nonce', async () => {
    const request = await idp.authorizationRequest();

    const params = request.url.searchParams;
    expect(request.url.origin + request.url.pathname).toBe(`${ISSUER}/authorize`);
    expect(params.get('code_challenge')).toBe(await oidc.calculatePKCECodeChallenge(request.codeVerifier));
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('state')).toBe(request.state);
    expect(params.get('nonce')).toBe(request.nonce);
    expect(params.get('redirect_uri')).toBe('https://shop.test/auth/callback');
  });

  it('exchanges the code and checks state and nonce', async () => {
    let form: URLSearchParams | undefined;
    server.use(
      http.post(`${ISSUER}/token`, async ({ request }) => {
        form = new URLSearchParams(await request.text());
        return HttpResponse.json({
          access_token: 'at-1',
          token_type: 'Bearer',
          expires_in: 300,
          refresh_token: 'rt-1',
          id_token: idToken({ sub: 'user-1', sid: 'sid-1', nonce: 'n-1' }),
        });
      }),
    );

    const tokens = await idp.exchangeCode(new URL('https://shop.test/auth/callback?code=c-1&state=s-1'), {
      codeVerifier: 'v'.repeat(43),
      state: 's-1',
      nonce: 'n-1',
    });

    expect(tokens).toEqual({
      subject: 'user-1',
      sid: 'sid-1',
      accessToken: 'at-1',
      accessTokenExpiresAt: expect.any(Number) as number, // expiresIn() counts down from the response time
      refreshToken: 'rt-1',
      idToken: expect.any(String) as string,
    });
    expect(tokens.accessTokenExpiresAt).toBeGreaterThan((NOW_S + 290) * 1000);
    expect(form?.get('code_verifier')).toBe('v'.repeat(43));
  });

  it('rejects a callback with the wrong state', async () => {
    await expect(
      idp.exchangeCode(new URL('https://shop.test/auth/callback?code=c-1&state=forged'), {
        codeVerifier: 'v'.repeat(43),
        state: 's-1',
        nonce: 'n-1',
      }),
    ).rejects.toThrow();
  });

  it('keeps subject and refresh token when the refresh response has neither', async () => {
    server.use(
      http.post(`${ISSUER}/token`, () =>
        HttpResponse.json({ access_token: 'at-2', token_type: 'Bearer', expires_in: 60 }),
      ),
    );

    const tokens = await idp.refresh({
      subject: 'user-1',
      sid: 'sid-1',
      accessToken: 'at-1',
      accessTokenExpiresAt: 0,
      refreshToken: 'rt-1',
      idToken: 'id-1',
    });

    expect(tokens).toMatchObject({ subject: 'user-1', accessToken: 'at-2', refreshToken: 'rt-1', idToken: 'id-1' });
  });

  it('builds the RP-initiated logout URL', async () => {
    const url = await idp.endSessionUrl('id-1');

    expect(url.searchParams.get('id_token_hint')).toBe('id-1');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('https://shop.test/');
  });
});
