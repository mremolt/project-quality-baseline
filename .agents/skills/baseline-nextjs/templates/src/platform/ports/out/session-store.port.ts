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
  /** Incremented on every write; compareAndSet fails on a mismatch (concurrent refresh). */
  readonly generation: number;
  readonly createdAt: number;
  readonly lastSeenAt: number;
  readonly xsrfToken: string;
  readonly pendingLogin: PendingLogin | undefined;
  readonly user: SessionUser | undefined;
}

/** Server-side session store (NEST-SEC-46): never the process memory in a deployment. */
export interface SessionStore {
  get(id: string): Promise<SessionData | undefined>;
  set(id: string, data: SessionData, ttlSeconds: number): Promise<void>;
  /** Atomic: writes only if the stored generation equals `expectedGeneration`; false if missing or changed. */
  compareAndSet(id: string, expectedGeneration: number, data: SessionData, ttlSeconds: number): Promise<boolean>;
  destroy(id: string): Promise<void>;
}
