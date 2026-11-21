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

  it('login redirects to the IdP and sets the pre-login session cookie', async () => {
    sessions.startLogin
      .calledWith('/orders')
      .mockResolvedValue({ sessionId: 'pre', redirectTo: new URL('https://idp.test/auth?x=1') });

    const response = await handlers.login(new Request('http://internal:3000/auth/login?returnTo=/orders'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://idp.test/auth?x=1');
    expect(response.headers.get('set-cookie')).toBe('__Host-session=pre; Path=/; HttpOnly; Secure; SameSite=Lax');
  });

  it('callback rebuilds the URL from the configured origin, never from the Host header', async () => {
    sessions.completeLogin.mockResolvedValue({ sessionId: 'new', xsrfToken: 'xt', returnTo: '/orders' });

    const response = await handlers.callback(
      new Request('http://attacker.test/auth/callback?code=c&state=s', { headers: { cookie: '__Host-session=pre' } }),
    );

    expect(sessions.completeLogin).toHaveBeenCalledWith(
      'pre',
      new URL('https://shop.test/auth/callback?code=c&state=s'),
    );
    expect(response.headers.get('location')).toBe('https://shop.test/orders');
    expect(response.headers.getSetCookie()).toEqual([
      '__Host-session=new; Path=/; HttpOnly; Secure; SameSite=Lax',
      'XSRF-TOKEN=xt; Path=/; Secure; SameSite=Strict',
    ]);
  });

  it('callback answers 400 when the login cannot be completed', async () => {
    sessions.completeLogin.mockRejectedValue(new LoginFailedError('no pending login'));

    const response = await handlers.callback(new Request('https://shop.test/auth/callback?code=c'));

    expect(response.status).toBe(400);
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
});
