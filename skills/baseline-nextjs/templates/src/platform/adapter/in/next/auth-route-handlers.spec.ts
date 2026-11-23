import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockReset } from 'vitest-mock-extended';

import type { SessionUseCase } from '../../../ports/in/session.use-case';
import { LoginFailedError } from '../../../ports/in/session.use-case';
import { createAuthRouteHandlers } from './auth-route-handlers';

describe('auth route handlers', () => {
  const sessions = mock<SessionUseCase>();
  const handlers = createAuthRouteHandlers(sessions, 'https://shop.test');

  beforeEach(() => {
    mockReset(sessions);
  });

  it('login redirects to the IdP and sets only the short-lived pre-login cookie, never the session cookie', async () => {
    sessions.startLogin
      .calledWith('/orders')
      .mockResolvedValue({ loginId: 'login-1', redirectTo: new URL('https://idp.test/auth?x=1'), ttlSeconds: 600 });

    const response = await handlers.login(
      new Request('http://internal:3000/auth/login?returnTo=/orders', { headers: { cookie: '__Host-session=live' } }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://idp.test/auth?x=1');
    expect(response.headers.getSetCookie()).toEqual([
      '__Host-login=login-1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600',
    ]);
  });

  it('callback rebuilds the URL from the configured origin, issues the session and clears the pre-login cookie', async () => {
    sessions.completeLogin.mockResolvedValue({ sessionId: 'new', xsrfToken: 'xt', returnTo: '/orders' });

    const response = await handlers.callback(
      new Request('http://attacker.test/auth/callback?code=c&state=s', {
        headers: { cookie: '__Host-login=login-1; __Host-session=old' },
      }),
    );

    expect(sessions.completeLogin).toHaveBeenCalledWith(
      'login-1',
      new URL('https://shop.test/auth/callback?code=c&state=s'),
      'old',
    );
    expect(response.headers.get('location')).toBe('https://shop.test/orders');
    expect(response.headers.getSetCookie()).toEqual([
      '__Host-session=new; Path=/; HttpOnly; Secure; SameSite=Lax',
      'XSRF-TOKEN=xt; Path=/; Secure; SameSite=Strict',
      '__Host-login=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    ]);
  });

  it('callback answers 400 when the login cannot be completed, clears the pre-login cookie and keeps the session', async () => {
    sessions.completeLogin.mockRejectedValue(new LoginFailedError('no pending login'));

    const response = await handlers.callback(
      new Request('https://shop.test/auth/callback?code=c', { headers: { cookie: '__Host-session=live' } }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(response.headers.getSetCookie()).toEqual([
      '__Host-login=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    ]);
  });

  it('callback lets an outage through as an error (500 and one log line from onRequestError)', async () => {
    const outage = new Error('session store unreachable');
    sessions.completeLogin.mockRejectedValue(outage);

    await expect(handlers.callback(new Request('https://shop.test/auth/callback?code=c'))).rejects.toBe(outage);
  });

  it('logout without the XSRF header is forbidden', async () => {
    sessions.resolve.calledWith('s-1').mockResolvedValue({ caller: { subject: 'u' }, xsrfToken: 'xt' });

    const response = await handlers.logout(
      new Request('https://shop.test/auth/logout', { method: 'POST', headers: { cookie: '__Host-session=s-1' } }),
    );

    expect(response.status).toBe(403);
    expect(sessions.logout).not.toHaveBeenCalled();
  });

  it('logout with the XSRF header ends the session and clears both cookies', async () => {
    sessions.resolve.calledWith('s-1').mockResolvedValue({ caller: { subject: 'u' }, xsrfToken: 'xt' });
    sessions.logout.calledWith('s-1').mockResolvedValue(new URL('https://idp.test/logout'));

    const response = await handlers.logout(
      new Request('https://shop.test/auth/logout', {
        method: 'POST',
        headers: { cookie: '__Host-session=s-1; XSRF-TOKEN=xt', 'x-xsrf-token': 'xt' },
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://idp.test/logout');
    expect(response.headers.getSetCookie()).toEqual([
      '__Host-session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      'XSRF-TOKEN=; Path=/; Secure; SameSite=Strict; Max-Age=0',
    ]);
  });

  it('logout called with fetch answers the end-session URL as JSON, so the browser client can navigate there', async () => {
    sessions.resolve.calledWith('s-1').mockResolvedValue({ caller: { subject: 'u' }, xsrfToken: 'xt' });
    sessions.logout.calledWith('s-1').mockResolvedValue(new URL('https://idp.test/logout'));

    const response = await handlers.logout(
      new Request('https://shop.test/auth/logout', {
        method: 'POST',
        headers: { cookie: '__Host-session=s-1; XSRF-TOKEN=xt', 'x-xsrf-token': 'xt', accept: 'application/json' },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirectUri: 'https://idp.test/logout' });
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it('logout still clears both cookies and goes home when the IdP cannot be reached', async () => {
    sessions.resolve.calledWith('s-1').mockResolvedValue({ caller: { subject: 'u' }, xsrfToken: 'xt' });
    sessions.logout.calledWith('s-1').mockResolvedValue(undefined);

    const response = await handlers.logout(
      new Request('https://shop.test/auth/logout', {
        method: 'POST',
        headers: { cookie: '__Host-session=s-1; XSRF-TOKEN=xt', 'x-xsrf-token': 'xt' },
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://shop.test/');
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });
});
