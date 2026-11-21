import type { RedisClientType } from 'redis';
import { z } from 'zod';

import type { PendingLogin, SessionData, SessionStore } from '../../../ports/out/session-store.port';

/** The commands the store uses; any `redis` client (RESP2 or RESP3, with or without modules) has them. */
type RedisClient = Pick<RedisClientType, 'get' | 'set' | 'eval' | 'del' | 'getDel'>;

const SESSION_PREFIX = 'session:';
const LOGIN_PREFIX = 'login:';
const REFRESH_LOCK_PREFIX = 'session-refresh:';

/** Atomic compare-and-set on the stored generation (NODE-BFF-03); 1 = written, 0 = missing or changed. */
const COMPARE_AND_SET = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
if cjson.decode(current).generation ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1`;

/** Deletes the lock only if the caller still holds it (its token); an expired and re-acquired lock stays. */
const RELEASE_LOCK = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;

const UserSchema = z.object({
  subject: z.string(),
  sid: z.string().optional(),
  accessToken: z.string(),
  accessTokenExpiresAt: z.number(),
  refreshToken: z.string().optional(),
  idToken: z.string().optional(),
});

const SessionDataSchema = z.object({
  generation: z.number().int(),
  createdAt: z.number(),
  lastSeenAt: z.number(),
  xsrfToken: z.string(),
  user: UserSchema.optional(),
});

const PendingLoginSchema = z.object({
  codeVerifier: z.string(),
  state: z.string(),
  nonce: z.string(),
  returnTo: z.string(),
});

function decode(raw: string): SessionData {
  const parsed = SessionDataSchema.parse(JSON.parse(raw));
  return {
    ...parsed,
    user: parsed.user && {
      ...parsed.user,
      sid: parsed.user.sid,
      refreshToken: parsed.user.refreshToken,
      idToken: parsed.user.idToken,
    },
  };
}

function randomLockToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');
}

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: RedisClient) {}

  async get(id: string): Promise<SessionData | undefined> {
    const raw = await this.redis.get(SESSION_PREFIX + id);
    return raw === null ? undefined : decode(raw);
  }

  async set(id: string, data: SessionData, ttlSeconds: number): Promise<void> {
    await this.redis.set(SESSION_PREFIX + id, JSON.stringify(data), { expiration: { type: 'EX', value: ttlSeconds } });
  }

  async compareAndSet(id: string, expectedGeneration: number, data: SessionData, ttlSeconds: number): Promise<boolean> {
    const written = await this.redis.eval(COMPARE_AND_SET, {
      keys: [SESSION_PREFIX + id],
      arguments: [String(expectedGeneration), JSON.stringify(data), String(ttlSeconds)],
    });
    return written === 1;
  }

  async destroy(id: string): Promise<void> {
    await this.redis.del(SESSION_PREFIX + id);
  }

  async savePendingLogin(loginId: string, login: PendingLogin, ttlSeconds: number): Promise<void> {
    await this.redis.set(LOGIN_PREFIX + loginId, JSON.stringify(login), {
      expiration: { type: 'EX', value: ttlSeconds },
    });
  }

  async takePendingLogin(loginId: string): Promise<PendingLogin | undefined> {
    const raw = await this.redis.getDel(LOGIN_PREFIX + loginId); // GETDEL: a second callback finds nothing
    return raw === null ? undefined : PendingLoginSchema.parse(JSON.parse(raw));
  }

  async acquireRefreshLock(id: string, ttlMs: number): Promise<string | undefined> {
    const token = randomLockToken();
    const acquired = await this.redis.set(REFRESH_LOCK_PREFIX + id, token, {
      condition: 'NX',
      expiration: { type: 'PX', value: ttlMs },
    });
    return acquired === 'OK' ? token : undefined;
  }

  async releaseRefreshLock(id: string, token: string): Promise<void> {
    await this.redis.eval(RELEASE_LOCK, { keys: [REFRESH_LOCK_PREFIX + id], arguments: [token] });
  }
}
