import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockReset } from 'vitest-mock-extended';

import type { IdentityProvider, Tokens } from '../ports/out/identity-provider.port';
import type { SessionData, SessionStore } from '../ports/out/session-store.port';
import { type SessionPolicy, SessionService } from './session.service';

const MINUTE = 60_000;
const policy: SessionPolicy = {
  idleMs: 30 * MINUTE,
  absoluteMs: 12 * 60 * MINUTE,
  refreshSkewMs: 30_000,
  returnToPattern: /^\/(?!\/)[\w\-/?=&.]{0,200}$/,
};
const tokens: Tokens = {
  subject: 'user-1',
  sid: 'sid-1',
  accessToken: 'at-1',
  accessTokenExpiresAt: 10 * MINUTE,
  refreshToken: 'rt-1',
  idToken: 'id-1',
};
const session = (overrides: Partial<SessionData> = {}): SessionData => ({
  generation: 3,
  createdAt: 0,
  lastSeenAt: 0,
  xsrfToken: 'x',
  pendingLogin: undefined,
  user: tokens,
  ...overrides,
});

describe('SessionService', () => {
  const store = mock<SessionStore>();
  const idp = mock<IdentityProvider>();
  let now = 0;
  const service = new SessionService(store, idp, policy, () => now);

  beforeEach(() => {
    mockReset(store);
    mockReset(idp);
    now = MINUTE;
    store.compareAndSet.mockResolvedValue(true);
  });

  it('starts a login with PKCE data in a pre-login session and refuses an absolute return URL', async () => {
    idp.authorizationRequest.mockResolvedValue({
      url: new URL('https://idp.test/auth'),
      codeVerifier: 'v',
      state: 's',
      nonce: 'n',
    });

    const start = await service.startLogin('//evil.test/');

    expect(start.redirectTo.href).toBe('https://idp.test/auth');
    expect(store.set).toHaveBeenCalledWith(
      start.sessionId,
      expect.objectContaining({
        pendingLogin: { codeVerifier: 'v', state: 's', nonce: 'n', returnTo: '/' },
        user: undefined,
      }),
      600,
    );
  });

  it('completes the login under a new session id and drops the pre-login session', async () => {
    store.get
      .calledWith('pre')
      .mockResolvedValue(
        session({ user: undefined, pendingLogin: { codeVerifier: 'v', state: 's', nonce: 'n', returnTo: '/orders' } }),
      );
    idp.exchangeCode.mockResolvedValue(tokens);

    const result = await service.completeLogin('pre', new URL('https://app.test/auth/callback?code=c&state=s'));

    expect(result.sessionId).not.toBe('pre');
    expect(result.returnTo).toBe('/orders');
    expect(store.destroy).toHaveBeenCalledWith('pre');
    expect(store.set).toHaveBeenCalledWith(result.sessionId, expect.objectContaining({ user: tokens }), 30 * 60);
  });

  it('rejects a session past its idle timeout', async () => {
    store.get.calledWith('s-1').mockResolvedValue(session({ lastSeenAt: 0 }));
    now = 31 * MINUTE;

    await expect(service.resolve('s-1')).resolves.toBeUndefined();
    expect(store.destroy).toHaveBeenCalledWith('s-1');
  });

  it('rejects a session past its absolute lifetime even when active', async () => {
    store.get.calledWith('s-1').mockResolvedValue(session({ createdAt: 0, lastSeenAt: 12 * 60 * MINUTE }));
    now = 12 * 60 * MINUTE + 1;

    await expect(service.resolve('s-1')).resolves.toBeUndefined();
  });

  it('resolves the caller and touches the session atomically', async () => {
    store.get.calledWith('s-1').mockResolvedValue(session());

    await expect(service.resolve('s-1')).resolves.toEqual({ caller: { subject: 'user-1' }, xsrfToken: 'x' });
    expect(store.compareAndSet).toHaveBeenCalledWith(
      's-1',
      3,
      expect.objectContaining({ generation: 4, lastSeenAt: MINUTE }),
      30 * 60,
    );
  });

  it('refreshes an access token shortly before expiry with compare-and-set', async () => {
    store.get.calledWith('s-1').mockResolvedValue(session());
    now = 10 * MINUTE - 10_000;
    idp.refresh.mockResolvedValue({ ...tokens, accessToken: 'at-2', accessTokenExpiresAt: 20 * MINUTE });

    await expect(service.accessToken('s-1')).resolves.toBe('at-2');
    expect(store.compareAndSet).toHaveBeenLastCalledWith(
      's-1',
      4,
      expect.objectContaining({ generation: 5 }),
      expect.any(Number),
    );
  });

  it('ends the session when the refresh fails', async () => {
    store.get.calledWith('s-1').mockResolvedValue(session());
    now = 10 * MINUTE;
    idp.refresh.mockRejectedValue(new Error('invalid_grant'));

    await expect(service.accessToken('s-1')).resolves.toBeUndefined();
    expect(store.destroy).toHaveBeenCalledWith('s-1');
  });

  it('logs out: destroys the session, revokes the refresh token, returns the end-session URL', async () => {
    store.get.calledWith('s-1').mockResolvedValue(session());
    idp.endSessionUrl.calledWith('id-1').mockResolvedValue(new URL('https://idp.test/logout'));

    await expect(service.logout('s-1')).resolves.toEqual(new URL('https://idp.test/logout'));
    expect(store.destroy).toHaveBeenCalledWith('s-1');
    expect(idp.revoke).toHaveBeenCalledWith('rt-1');
  });
});
