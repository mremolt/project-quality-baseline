import type { LoginResult, LoginStart, ResolvedSession, SessionUseCase } from '../ports/in/session.use-case';
import { LoginFailedError } from '../ports/in/session.use-case';
import { type IdentityProvider, LoginRejectedError, type Tokens } from '../ports/out/identity-provider.port';
import type { SessionData, SessionStore, SessionUser } from '../ports/out/session-store.port';
import { untilDeadline } from './deadline';

export interface SessionPolicy {
  readonly idleMs: number;
  readonly absoluteMs: number;
  /** Refresh the access token when it expires within this window. */
  readonly refreshSkewMs: number;
  /** Lifetime of the cross-instance refresh lock: longer than one IdP refresh call (OIDC_TIMEOUT_S). */
  readonly refreshLockMs: number;
  /** How often a caller that waits for another instance's refresh re-reads the session. */
  readonly refreshPollMs: number;
  /** Relative paths a login may return to. */
  readonly returnToPattern: RegExp;
}

const PENDING_LOGIN_TTL_S = 600;
/** Writes of a refreshed token that lost a compare-and-set to a concurrent writer and merge onto its record. */
const MAX_MERGE_ATTEMPTS = 3;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SessionService implements SessionUseCase {
  /** In-process single flight: one refresh per session and instance; the Redis lock covers the other instances. */
  private readonly refreshing = new Map<string, Promise<string | undefined>>();

  constructor(
    private readonly store: SessionStore,
    private readonly idp: IdentityProvider,
    private readonly policy: SessionPolicy,
    private readonly now: () => number,
  ) {}

  async startLogin(returnTo: string): Promise<LoginStart> {
    const request = await this.idp.authorizationRequest();
    const loginId = randomToken();
    await this.store.savePendingLogin(
      loginId,
      {
        codeVerifier: request.codeVerifier,
        state: request.state,
        nonce: request.nonce,
        returnTo: this.policy.returnToPattern.test(returnTo) ? returnTo : '/',
      },
      PENDING_LOGIN_TTL_S,
    );
    return { loginId, redirectTo: request.url, ttlSeconds: PENDING_LOGIN_TTL_S };
  }

  async completeLogin(
    loginId: string | undefined,
    callbackUrl: URL,
    currentSessionId: string | undefined,
  ): Promise<LoginResult> {
    const pending = loginId ? await this.store.takePendingLogin(loginId) : undefined; // used at most once
    if (!pending) throw new LoginFailedError('no pending login');
    let tokens;
    try {
      tokens = await this.idp.exchangeCode(callbackUrl, pending);
    } catch (error) {
      // a rejected response is the user's failed login (400); an IdP outage stays an error (5xx, logged)
      if (error instanceof LoginRejectedError) throw new LoginFailedError('login rejected', { cause: error });
      throw error;
    }
    const sessionId = randomToken(); // always a new id: nothing an attacker planted becomes the session (NODE-BFF-07)
    const at = this.now();
    const xsrfToken = randomToken();
    await this.store.set(
      sessionId,
      { generation: 0, createdAt: at, lastSeenAt: at, xsrfToken, user: tokens },
      this.ttlSeconds(at, at),
    );
    if (currentSessionId) await this.store.destroy(currentSessionId); // the new login replaces the old session
    return { sessionId, xsrfToken, returnTo: pending.returnTo };
  }

  async resolve(sessionId: string | undefined, deadline?: AbortSignal): Promise<ResolvedSession | undefined> {
    deadline?.throwIfAborted();
    const session = await untilDeadline(this.active(sessionId), deadline);
    if (!session) return undefined;
    return {
      caller: session.data.user ? { subject: session.data.user.subject } : undefined,
      xsrfToken: session.data.xsrfToken,
    };
  }

  async accessToken(sessionId: string | undefined, deadline?: AbortSignal): Promise<string | undefined> {
    deadline?.throwIfAborted();
    const session = await untilDeadline(this.active(sessionId), deadline);
    const user = session?.data.user;
    if (!session || !user) return undefined;
    if (this.isFresh(user)) return user.accessToken;
    if (!user.refreshToken) return undefined;
    let flight = this.refreshing.get(session.id);
    if (!flight) {
      const id = session.id;
      flight = this.refreshOnce(id).finally(() => this.refreshing.delete(id));
      this.refreshing.set(id, flight);
    }
    // the caller stops waiting at its deadline; the shared refresh runs on and stores its result for the next call
    return untilDeadline(flight, deadline);
  }

  async logout(sessionId: string | undefined): Promise<URL | undefined> {
    const data = sessionId ? await this.store.get(sessionId) : undefined;
    if (sessionId) await this.store.destroy(sessionId);
    const user = data?.user;
    // the local session is gone; an unreachable IdP must not turn logout into an error (NODE-BFF-08)
    try {
      if (user?.refreshToken) await this.idp.revoke(user.refreshToken);
    } catch {
      // the refresh token is gone with the session; the IdP lets it expire
    }
    try {
      return await this.idp.endSessionUrl(user?.idToken);
    } catch {
      return undefined;
    }
  }

  /** One refresh across instances: the lock holder refreshes, everyone else re-reads until the new token is there. */
  private async refreshOnce(id: string): Promise<string | undefined> {
    const attempts = Math.ceil(this.policy.refreshLockMs / this.policy.refreshPollMs) + 2; // the lock expires by then
    for (let attempt = 0; attempt < attempts; attempt++) {
      const lock = await this.store.acquireRefreshLock(id, this.policy.refreshLockMs);
      if (lock) {
        try {
          return await this.refreshHoldingLock(id);
        } finally {
          await this.releaseLock(id, lock);
        }
      }
      await sleep(this.policy.refreshPollMs);
      const current = await this.store.get(id);
      if (!current?.user) return undefined; // ended meanwhile: failed refresh elsewhere, logout
      if (this.isFresh(current.user)) return current.user.accessToken; // another instance refreshed
    }
    throw new Error('session refresh lock was not released in time');
  }

  private async releaseLock(id: string, lock: string): Promise<void> {
    try {
      await this.store.releaseRefreshLock(id, lock);
    } catch {
      // the lock expires by itself after refreshLockMs
    }
  }

  private async refreshHoldingLock(id: string): Promise<string | undefined> {
    const current = await this.store.get(id); // another holder may have refreshed before this one got the lock
    const user = current?.user;
    if (!current || !user) return undefined;
    if (this.isFresh(user)) return user.accessToken;
    if (!user.refreshToken) return undefined;
    let refreshed: Tokens;
    try {
      refreshed = await this.idp.refresh({ ...user, refreshToken: user.refreshToken });
    } catch {
      await this.store.destroy(id); // a failed refresh ends the session (NODE-BFF-07)
      return undefined;
    }
    return this.storeRefreshed(id, current, refreshed);
  }

  /**
   * Writes the refreshed tokens with compare-and-set. A lost write is merged onto the newer record and retried: the IdP
   * may have rotated the refresh token, and only the new one stays valid.
   */
  private async storeRefreshed(id: string, base: SessionData, refreshed: Tokens): Promise<string | undefined> {
    let current: SessionData | undefined = base;
    for (let attempt = 0; attempt < MAX_MERGE_ATTEMPTS && current; attempt++) {
      const data: SessionData = { ...current, generation: current.generation + 1, user: refreshed };
      const ttl = this.ttlSeconds(data.createdAt, data.lastSeenAt);
      if (await this.store.compareAndSet(id, current.generation, data, ttl)) return refreshed.accessToken;
      current = await this.store.get(id);
    }
    return current ? refreshed.accessToken : undefined; // gone: logged out meanwhile
  }

  private isFresh(user: SessionUser): boolean {
    return user.accessTokenExpiresAt - this.now() > this.policy.refreshSkewMs;
  }

  private async active(sessionId: string | undefined): Promise<{ id: string; data: SessionData } | undefined> {
    if (!sessionId) return undefined;
    const data = await this.store.get(sessionId);
    if (!data) return undefined;
    const at = this.now();
    if (at - data.lastSeenAt > this.policy.idleMs || at - data.createdAt > this.policy.absoluteMs) {
      await this.store.destroy(sessionId);
      return undefined;
    }
    // an idle touch keeps the generation, so it never makes a concurrent refresh lose its compare-and-set
    const touched: SessionData = { ...data, lastSeenAt: at };
    const written = await this.store.compareAndSet(
      sessionId,
      data.generation,
      touched,
      this.ttlSeconds(data.createdAt, at),
    );
    return { id: sessionId, data: written ? touched : data };
  }

  private ttlSeconds(createdAt: number, lastSeenAt: number): number {
    const until = Math.min(lastSeenAt + this.policy.idleMs, createdAt + this.policy.absoluteMs);
    return Math.max(1, Math.ceil((until - this.now()) / 1000));
  }
}
