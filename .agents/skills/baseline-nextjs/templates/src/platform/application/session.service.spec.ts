import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockReset } from 'vitest-mock-extended';

import { LoginFailedError } from '../ports/in/session.use-case';
import { type IdentityProvider, LoginRejectedError, type Tokens } from '../ports/out/identity-provider.port';
import type { PendingLogin, SessionData, SessionStore } from '../ports/out/session-store.port';
import { type SessionPolicy, SessionService } from './session.service';

const MINUTE = 60_000;
const policy: SessionPolicy = {
  idleMs: 30 * MINUTE,
  absoluteMs: 12 * 60 * MINUTE,
  refreshSkewMs: 30_000,
  refreshLockMs: 50,
  refreshPollMs: 1,
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
const refreshedTokens: Tokens = {
  ...tokens,
  accessToken: 'at-2',
  accessTokenExpiresAt: 20 * MINUTE,
  refreshToken: 'rt-2',
};
const pending: PendingLogin = { codeVerifier: 'v', state: 's', nonce: 'n', returnTo: '/orders' };
const session = (overrides: Partial<SessionData> = {}): SessionData => ({
  generation: 3,
  createdAt: 0,
  lastSeenAt: 0,
  xsrfToken: 'x',
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
    store.acquireRefreshLock.mockResolvedValue('lock-1');
  });

  describe('login (NODE-BFF-02, NODE-BFF-07)', () => {
    it('keeps the PKCE data in a short-lived pre-login record, never in a session, and refuses an absolute return URL', async () => {
      idp.authorizationRequest.mockResolvedValue({
        url: new URL('https://idp.test/auth'),
        codeVerifier: 'v',
        state: 's',
        nonce: 'n',
      });

      const start = await service.startLogin('//evil.test/');

      expect(start.redirectTo.href).toBe('https://idp.test/auth');
      expect(start.ttlSeconds).toBe(600);
      expect(store.savePendingLogin).toHaveBeenCalledWith(
        start.loginId,
        { codeVerifier: 'v', state: 's', nonce: 'n', returnTo: '/' },
        600,
      );
      expect(store.set).not.toHaveBeenCalled();
      expect(store.destroy).not.toHaveBeenCalled(); // a live session survives a new login start
    });

    it('completes the login under a new session id, consumes the pre-login record and ends the previous session', async () => {
      store.takePendingLogin.calledWith('login-1').mockResolvedValue(pending);
      idp.exchangeCode.mockResolvedValue(tokens);

      const result = await service.completeLogin(
        'login-1',
        new URL('https://app.test/auth/callback?code=c&state=s'),
        'old-session',
      );

      expect(result.sessionId).not.toBe('old-session');
      expect(result.sessionId).not.toBe('login-1');
      expect(result.returnTo).toBe('/orders');
      expect(store.set).toHaveBeenCalledWith(
        result.sessionId,
        expect.objectContaining({ user: tokens, xsrfToken: result.xsrfToken }),
        30 * 60,
      );
      expect(store.destroy).toHaveBeenCalledWith('old-session'); // session id rotated (fixation)
    });

    it('fails without a pending login and leaves a live session alone', async () => {
      store.takePendingLogin.mockResolvedValue(undefined);

      await expect(service.completeLogin('login-1', new URL('https://app.test/auth/callback'), 'live')).rejects.toThrow(
        LoginFailedError,
      );
      await expect(service.completeLogin(undefined, new URL('https://app.test/auth/callback'), 'live')).rejects.toThrow(
        LoginFailedError,
      );
      expect(store.destroy).not.toHaveBeenCalled();
      expect(idp.exchangeCode).not.toHaveBeenCalled();
    });

    it('turns a rejected authorization response into a failed login, and keeps outages as errors', async () => {
      store.takePendingLogin.mockResolvedValue(pending);
      const callback = new URL('https://app.test/auth/callback?code=c&state=forged');

      idp.exchangeCode.mockRejectedValueOnce(new LoginRejectedError('state mismatch'));
      await expect(service.completeLogin('login-1', callback, 'live')).rejects.toThrow(LoginFailedError);

      const outage = new Error('IdP unreachable');
      idp.exchangeCode.mockRejectedValueOnce(outage);
      await expect(service.completeLogin('login-1', callback, 'live')).rejects.toBe(outage);
      expect(store.destroy).not.toHaveBeenCalled();
    });
  });

  describe('lifetimes (NODE-BFF-07)', () => {
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

    it('resolves the caller and touches the session without bumping its generation', async () => {
      store.get.calledWith('s-1').mockResolvedValue(session());

      await expect(service.resolve('s-1')).resolves.toEqual({ caller: { subject: 'user-1' }, xsrfToken: 'x' });
      expect(store.compareAndSet).toHaveBeenCalledWith(
        's-1',
        3,
        expect.objectContaining({ generation: 3, lastSeenAt: MINUTE }),
        30 * 60,
      );
    });
  });

  describe('token refresh (NODE-BFF-07, D5)', () => {
    it('refreshes an access token shortly before expiry under the refresh lock, with compare-and-set', async () => {
      store.get.calledWith('s-1').mockResolvedValue(session());
      now = 10 * MINUTE - 10_000;
      idp.refresh.mockResolvedValue(refreshedTokens);

      await expect(service.accessToken('s-1')).resolves.toBe('at-2');
      expect(store.acquireRefreshLock).toHaveBeenCalledWith('s-1', 50);
      expect(store.compareAndSet).toHaveBeenLastCalledWith(
        's-1',
        3,
        expect.objectContaining({ generation: 4, user: refreshedTokens }),
        expect.any(Number),
      );
      expect(store.releaseRefreshLock).toHaveBeenCalledWith('s-1', 'lock-1');
    });

    it('ends the session when the refresh fails', async () => {
      store.get.calledWith('s-1').mockResolvedValue(session());
      now = 10 * MINUTE;
      idp.refresh.mockRejectedValue(new Error('invalid_grant'));

      await expect(service.accessToken('s-1')).resolves.toBeUndefined();
      expect(store.destroy).toHaveBeenCalledWith('s-1');
      expect(store.releaseRefreshLock).toHaveBeenCalledWith('s-1', 'lock-1');
    });

    it('sends concurrent calls of one instance to one IdP refresh', async () => {
      const fake = new FakeSessionStore(session());
      const local = new SessionService(fake, idp, policy, () => now);
      now = 10 * MINUTE;
      idp.refresh.mockImplementation(async () => {
        await sleep(5);
        return refreshedTokens;
      });

      const results = await Promise.all([local.accessToken('s-1'), local.accessToken('s-1'), local.accessToken('s-1')]);

      expect(results).toEqual(['at-2', 'at-2', 'at-2']);
      expect(idp.refresh).toHaveBeenCalledTimes(1);
      expect(fake.data?.user?.refreshToken).toBe('rt-2');
    });

    it('waits for another instance that holds the lock and reads its refreshed token back', async () => {
      const fake = new FakeSessionStore(session());
      fake.lockHolder = 'other-instance';
      const local = new SessionService(fake, idp, policy, () => now);
      now = 10 * MINUTE;
      setTimeout(() => {
        fake.data = session({ generation: 4, user: refreshedTokens }); // the other instance's write
      }, 5);

      await expect(local.accessToken('s-1')).resolves.toBe('at-2');
      expect(idp.refresh).not.toHaveBeenCalled();
    });

    it('takes the lock over once it expired and refreshes itself', async () => {
      const fake = new FakeSessionStore(session());
      fake.lockHolder = 'crashed-instance';
      setTimeout(() => {
        fake.lockHolder = undefined; // PX expiry
      }, 10);
      const local = new SessionService(fake, idp, policy, () => now);
      now = 10 * MINUTE;
      idp.refresh.mockResolvedValue(refreshedTokens);

      await expect(local.accessToken('s-1')).resolves.toBe('at-2');
      expect(idp.refresh).toHaveBeenCalledTimes(1);
    });

    it('merges onto the newer record after a lost compare-and-set and keeps the rotated refresh token', async () => {
      const fake = new FakeSessionStore(session());
      fake.beforeCompareAndSet = (data) => {
        if (data.user?.refreshToken !== 'rt-2') return;
        fake.beforeCompareAndSet = undefined;
        fake.data = session({ generation: 7, lastSeenAt: 2 * MINUTE }); // a concurrent writer wins once
      };
      const local = new SessionService(fake, idp, policy, () => now);
      now = 10 * MINUTE;
      idp.refresh.mockResolvedValue(refreshedTokens);

      await expect(local.accessToken('s-1')).resolves.toBe('at-2');
      expect(fake.data).toMatchObject({
        generation: 8,
        lastSeenAt: 2 * MINUTE,
        user: { refreshToken: 'rt-2', accessToken: 'at-2' },
      });
      expect(idp.refresh).toHaveBeenCalledTimes(1);
    });

    it('gives up at the caller deadline while the shared refresh finishes and is stored (NEXT-RES-03)', async () => {
      const fake = new FakeSessionStore(session());
      const local = new SessionService(fake, idp, policy, () => now);
      now = 10 * MINUTE;
      let finishRefresh: ((value: Tokens) => void) | undefined;
      idp.refresh.mockReturnValue(
        new Promise<Tokens>((resolve) => {
          finishRefresh = resolve;
        }),
      );
      const deadline = new AbortController();

      const call = local.accessToken('s-1', deadline.signal);
      await sleep(2);
      deadline.abort(new DOMException('deadline', 'TimeoutError'));

      await expect(call).rejects.toMatchObject({ name: 'TimeoutError' });
      finishRefresh?.(refreshedTokens);
      await expect(local.accessToken('s-1')).resolves.toBe('at-2');
      expect(idp.refresh).toHaveBeenCalledTimes(1);
    });

    it('stops before the session lookup when the deadline has passed', async () => {
      const deadline = AbortSignal.abort(new DOMException('deadline', 'TimeoutError'));

      await expect(service.resolve('s-1', deadline)).rejects.toMatchObject({ name: 'TimeoutError' });
      expect(store.get).not.toHaveBeenCalled();
    });
  });

  describe('logout (NODE-BFF-08)', () => {
    it('destroys the session, revokes the refresh token, returns the end-session URL', async () => {
      store.get.calledWith('s-1').mockResolvedValue(session());
      idp.endSessionUrl.calledWith('id-1').mockResolvedValue(new URL('https://idp.test/logout'));

      await expect(service.logout('s-1')).resolves.toEqual(new URL('https://idp.test/logout'));
      expect(store.destroy).toHaveBeenCalledWith('s-1');
      expect(idp.revoke).toHaveBeenCalledWith('rt-1');
    });

    it('ends the session even when the IdP cannot be reached', async () => {
      store.get.calledWith('s-1').mockResolvedValue(session());
      idp.revoke.mockRejectedValue(new Error('timeout'));
      idp.endSessionUrl.mockRejectedValue(new Error('timeout'));

      await expect(service.logout('s-1')).resolves.toBeUndefined();
      expect(store.destroy).toHaveBeenCalledWith('s-1');
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One session `s-1` with the store's semantics (generation compare-and-set, NX lock), for the concurrency cases. */
class FakeSessionStore implements SessionStore {
  lockHolder: string | undefined;
  beforeCompareAndSet: ((data: SessionData) => void) | undefined;

  constructor(public data: SessionData | undefined) {}

  get(): Promise<SessionData | undefined> {
    return Promise.resolve(this.data);
  }
  set(_id: string, data: SessionData): Promise<void> {
    this.data = data;
    return Promise.resolve();
  }
  compareAndSet(_id: string, expectedGeneration: number, data: SessionData): Promise<boolean> {
    this.beforeCompareAndSet?.(data);
    if (this.data?.generation !== expectedGeneration) return Promise.resolve(false);
    this.data = data;
    return Promise.resolve(true);
  }
  destroy(): Promise<void> {
    this.data = undefined;
    return Promise.resolve();
  }
  savePendingLogin(): Promise<void> {
    return Promise.resolve();
  }
  takePendingLogin(): Promise<PendingLogin | undefined> {
    return Promise.resolve(undefined);
  }
  acquireRefreshLock(): Promise<string | undefined> {
    if (this.lockHolder) return Promise.resolve(undefined);
    this.lockHolder = 'this-instance';
    return Promise.resolve(this.lockHolder);
  }
  releaseRefreshLock(_id: string, token: string): Promise<void> {
    if (this.lockHolder === token) this.lockHolder = undefined;
    return Promise.resolve();
  }
}
