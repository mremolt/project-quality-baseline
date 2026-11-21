import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SessionData } from '../../../ports/out/session-store.port';
import { RedisSessionStore } from './redis-session-store';

const data = (generation: number): SessionData => ({
  generation,
  createdAt: 1,
  lastSeenAt: 2,
  xsrfToken: 'x',
  user: {
    subject: 'u',
    sid: undefined,
    accessToken: 'a',
    accessTokenExpiresAt: 3,
    refreshToken: 'r',
    idToken: undefined,
  },
});

describe('RedisSessionStore (Redis in a container)', () => {
  let container: StartedRedisContainer;
  let redis: ReturnType<typeof createClient>;
  let store: RedisSessionStore;

  beforeAll(async () => {
    container = await new RedisContainer('redis:8.4-alpine').start();
    redis = createClient({ url: container.getConnectionUrl() });
    await redis.connect();
    store = new RedisSessionStore(redis);
  }, 120_000);

  afterAll(async () => {
    redis.destroy();
    await container.stop();
  });

  it('stores and reads a session with its TTL', async () => {
    await store.set('s-1', data(0), 60);

    expect(await store.get('s-1')).toEqual(data(0));
    expect(await redis.ttl('session:s-1')).toBeGreaterThan(55);
  });

  it('compareAndSet writes only on the expected generation', async () => {
    await store.set('s-2', data(0), 60);

    expect(await store.compareAndSet('s-2', 0, data(1), 60)).toBe(true);
    expect(await store.compareAndSet('s-2', 0, data(2), 60)).toBe(false);
    expect((await store.get('s-2'))?.generation).toBe(1);
  });

  it('compareAndSet fails on a missing session and destroy removes it', async () => {
    expect(await store.compareAndSet('missing', 0, data(1), 60)).toBe(false);
    await store.set('s-3', data(0), 60);
    await store.destroy('s-3');
    expect(await store.get('s-3')).toBeUndefined();
  });

  it('lets exactly one of two concurrent writers win', async () => {
    await store.set('s-4', data(5), 60);

    const results = await Promise.all([
      store.compareAndSet('s-4', 5, data(6), 60),
      store.compareAndSet('s-4', 5, data(6), 60),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('keeps a pending login under its own key with its TTL and hands it out once', async () => {
    const login = { codeVerifier: 'v', state: 's', nonce: 'n', returnTo: '/orders' };
    await store.savePendingLogin('l-1', login, 600);

    expect(await redis.ttl('login:l-1')).toBeGreaterThan(595);
    expect(await store.get('l-1')).toBeUndefined(); // never a session
    const taken = await Promise.all([store.takePendingLogin('l-1'), store.takePendingLogin('l-1')]);
    expect(taken.filter(Boolean)).toEqual([login]);
  });

  it('gives the refresh lock to one holder, releases it only for that holder and lets it expire', async () => {
    const [first, second] = await Promise.all([
      store.acquireRefreshLock('s-5', 60_000),
      store.acquireRefreshLock('s-5', 60_000),
    ]);
    const holder = first ?? second;

    expect([first, second].filter(Boolean)).toHaveLength(1);
    await store.releaseRefreshLock('s-5', 'someone-else');
    expect(await store.acquireRefreshLock('s-5', 60_000)).toBeUndefined();
    await store.releaseRefreshLock('s-5', holder ?? '');
    expect(await store.acquireRefreshLock('s-5', 50)).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await store.acquireRefreshLock('s-5', 50)).toBeDefined(); // PX expiry: a crashed holder blocks no one
  });
});
