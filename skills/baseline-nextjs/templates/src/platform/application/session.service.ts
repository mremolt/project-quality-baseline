import type { LoginResult, LoginStart, ResolvedSession, SessionUseCase } from '../ports/in/session.use-case';
import { LoginFailedError } from '../ports/in/session.use-case';
import type { IdentityProvider } from '../ports/out/identity-provider.port';
import type { SessionData, SessionStore } from '../ports/out/session-store.port';

export interface SessionPolicy {
  readonly idleMs: number;
  readonly absoluteMs: number;
  /** Refresh the access token when it expires within this window. */
  readonly refreshSkewMs: number;
  /** Relative paths a login may return to. */
  readonly returnToPattern: RegExp;
}

const PENDING_LOGIN_TTL_S = 600;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export class SessionService implements SessionUseCase {
  constructor(
    private readonly store: SessionStore,
    private readonly idp: IdentityProvider,
    private readonly policy: SessionPolicy,
    private readonly now: () => number,
  ) {}

  async startLogin(returnTo: string): Promise<LoginStart> {
    const request = await this.idp.authorizationRequest();
    const sessionId = randomToken();
    const at = this.now();
    const safeReturnTo = this.policy.returnToPattern.test(returnTo) ? returnTo : '/';
    await this.store.set(
      sessionId,
      {
        generation: 0,
        createdAt: at,
        lastSeenAt: at,
        xsrfToken: randomToken(),
        pendingLogin: {
          codeVerifier: request.codeVerifier,
          state: request.state,
          nonce: request.nonce,
          returnTo: safeReturnTo,
        },
        user: undefined,
      },
      PENDING_LOGIN_TTL_S,
    );
    return { sessionId, redirectTo: request.url };
  }

  async completeLogin(sessionId: string | undefined, callbackUrl: URL): Promise<LoginResult> {
    const pending = sessionId ? (await this.store.get(sessionId))?.pendingLogin : undefined;
    if (!sessionId || !pending) throw new LoginFailedError('no pending login');
    await this.store.destroy(sessionId); // the pre-login session id never becomes the user's session (NEST-SEC-49)
    const tokens = await this.idp.exchangeCode(callbackUrl, pending);
    const newId = randomToken();
    const at = this.now();
    const xsrfToken = randomToken();
    await this.store.set(
      newId,
      { generation: 0, createdAt: at, lastSeenAt: at, xsrfToken, pendingLogin: undefined, user: tokens },
      this.ttlSeconds(at, at),
    );
    return { sessionId: newId, xsrfToken, returnTo: pending.returnTo };
  }

  async resolve(sessionId: string | undefined): Promise<ResolvedSession | undefined> {
    const session = await this.active(sessionId);
    if (!session) return undefined;
    return {
      caller: session.data.user ? { subject: session.data.user.subject } : undefined,
      xsrfToken: session.data.xsrfToken,
    };
  }

  async accessToken(sessionId: string | undefined): Promise<string | undefined> {
    const session = await this.active(sessionId);
    const user = session?.data.user;
    if (!session || !user) return undefined;
    if (user.accessTokenExpiresAt - this.now() > this.policy.refreshSkewMs) return user.accessToken;
    const { refreshToken } = user;
    if (!refreshToken) return undefined;
    try {
      const refreshed = await this.idp.refresh({ ...user, refreshToken });
      const data: SessionData = { ...session.data, generation: session.data.generation + 1, user: refreshed };
      const written = await this.store.compareAndSet(
        session.id,
        session.data.generation,
        data,
        this.ttlSeconds(data.createdAt, data.lastSeenAt),
      );
      if (written) return refreshed.accessToken;
      return (await this.store.get(session.id))?.user?.accessToken; // a concurrent request refreshed first
    } catch {
      await this.store.destroy(session.id); // a failed refresh ends the session (NEST-SEC-49)
      return undefined;
    }
  }

  async logout(sessionId: string | undefined): Promise<URL> {
    const data = sessionId ? await this.store.get(sessionId) : undefined;
    if (sessionId) await this.store.destroy(sessionId);
    const user = data?.user;
    if (user?.refreshToken) await this.idp.revoke(user.refreshToken);
    return this.idp.endSessionUrl(user?.idToken);
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
    const touched: SessionData = { ...data, generation: data.generation + 1, lastSeenAt: at };
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
