import { http, HttpResponse } from 'msw';

const base64url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * Test mode only (NEXT-D5): an OIDC provider for the stubbed E2E tier. The E2E test answers the browser's
 * authorization request with `code=<nonce>`, so the token endpoint can put the expected nonce into the ID token.
 * The code flow takes the ID token from the token endpoint over TLS; openid-client checks its claims, not a signature.
 */
export const idpStubHandlers = [
  http.get('*/.well-known/openid-configuration', ({ request }) => {
    const issuer = new URL(request.url).origin;
    return HttpResponse.json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      end_session_endpoint: `${issuer}/logout`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
    });
  }),
  http.post('*/token', async ({ request }) => {
    const form = new URLSearchParams(await request.text());
    const issuer = new URL(request.url).origin;
    const clientId = Buffer.from(request.headers.get('authorization')?.slice('Basic '.length) ?? '', 'base64')
      .toString()
      .split(':')[0];
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: issuer, aud: clientId, sub: 'e2e-user', sid: 'e2e-sid', iat: now, exp: now + 300 };
    return HttpResponse.json({
      access_token: 'stub-access-token',
      token_type: 'Bearer',
      expires_in: 300,
      refresh_token: 'stub-refresh-token',
      id_token: `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({ ...claims, nonce: form.get('code') })}.c3R1Yg`,
    });
  }),
];
