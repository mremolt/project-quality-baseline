import type { RedisClientType } from 'redis';
import { z } from 'zod';

import type { SessionData, SessionStore } from '../../../ports/out/session-store.port';

/** The commands the store uses; any `redis` client (RESP2 or RESP3, with or without modules) has them. */
type RedisClient = Pick<RedisClientType, 'get' | 'set' | 'eval' | 'del'>;

const KEY_PREFIX = 'session:';

/** Atomic compare-and-set on the stored generation (NEST-SEC-46); 1 = written, 0 = missing or changed. */
const COMPARE_AND_SET = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
if cjson.decode(current).generation ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1`;

const SessionDataSchema = z.object({
  generation: z.number().int(),
  createdAt: z.number(),
  lastSeenAt: z.number(),
  xsrfToken: z.string(),
  pendingLogin: z
    .object({ codeVerifier: z.string(), state: z.string(), nonce: z.string(), returnTo: z.string() })
    .optional(),
  user: z
    .object({
      subject: z.string(),
      sid: z.string().optional(),
      accessToken: z.string(),
      accessTokenExpiresAt: z.number(),
      refreshToken: z.string().optional(),
      idToken: z.string().optional(),
    })
    .optional(),
});

function decode(raw: string): SessionData {
  const parsed = SessionDataSchema.parse(JSON.parse(raw));
  return {
    ...parsed,
    pendingLogin: parsed.pendingLogin,
    user: parsed.user && {
      ...parsed.user,
      sid: parsed.user.sid,
      refreshToken: parsed.user.refreshToken,
      idToken: parsed.user.idToken,
    },
  };
}

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: RedisClient) {}

  async get(id: string): Promise<SessionData | undefined> {
    const raw = await this.redis.get(KEY_PREFIX + id);
    return raw === null ? undefined : decode(raw);
  }

  async set(id: string, data: SessionData, ttlSeconds: number): Promise<void> {
    await this.redis.set(KEY_PREFIX + id, JSON.stringify(data), { expiration: { type: 'EX', value: ttlSeconds } });
  }

  async compareAndSet(id: string, expectedGeneration: number, data: SessionData, ttlSeconds: number): Promise<boolean> {
    const written = await this.redis.eval(COMPARE_AND_SET, {
      keys: [KEY_PREFIX + id],
      arguments: [String(expectedGeneration), JSON.stringify(data), String(ttlSeconds)],
    });
    return written === 1;
  }

  async destroy(id: string): Promise<void> {
    await this.redis.del(KEY_PREFIX + id);
  }
}
