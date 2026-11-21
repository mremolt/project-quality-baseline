/** The state a login keeps between `/auth/login` and `/auth/callback`, under its own short-lived id (NODE-BFF-02). */
export interface PendingLogin {
  readonly codeVerifier: string;
  readonly state: string;
  readonly nonce: string;
  readonly returnTo: string;
}

export interface SessionUser {
  readonly subject: string;
  readonly sid: string | undefined;
  readonly accessToken: string;
  /** Epoch milliseconds. */
  readonly accessTokenExpiresAt: number;
  readonly refreshToken: string | undefined;
  readonly idToken: string | undefined;
}

export interface SessionData {
  /** Incremented when the tokens change, not on idle touches; compareAndSet fails on a mismatch (concurrent refresh). */
  readonly generation: number;
  readonly createdAt: number;
  readonly lastSeenAt: number;
  readonly xsrfToken: string;
  readonly user: SessionUser | undefined;
}

/** Server-side session store (NODE-BFF-03): never the process memory in a deployment. */
export interface SessionStore {
  get(id: string): Promise<SessionData | undefined>;
  set(id: string, data: SessionData, ttlSeconds: number): Promise<void>;
  /** Atomic: writes only if the stored generation equals `expectedGeneration`; false if missing or changed. */
  compareAndSet(id: string, expectedGeneration: number, data: SessionData, ttlSeconds: number): Promise<boolean>;
  destroy(id: string): Promise<void>;
  /** The pre-login record; it never touches a session (NODE-BFF-02, NODE-BFF-07). */
  savePendingLogin(loginId: string, login: PendingLogin, ttlSeconds: number): Promise<void>;
  /** Atomic read-and-delete: a pending login completes at most once. */
  takePendingLogin(loginId: string): Promise<PendingLogin | undefined>;
  /**
   * The refresh lock of a session across instances (D5): a lock token when acquired, undefined while another holder
   * has it. It expires after `ttlMs` by itself, so a crashed holder blocks no one for longer.
   */
  acquireRefreshLock(id: string, ttlMs: number): Promise<string | undefined>;
  /** Releases the lock only if `token` still holds it. */
  releaseRefreshLock(id: string, token: string): Promise<void>;
}
