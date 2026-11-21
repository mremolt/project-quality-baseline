import { AsyncLocalStorage } from 'node:async_hooks';

import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { TechnicalError, UnauthenticatedError } from '../../../domain';
import { HttpProblem } from './http-problem';
import { configureServerFetch, customFetch } from './server-fetch';

describe('server customFetch (NEXT-API-03/04, NEXT-API-08)', () => {
  const server = setupServer();
  let token: string | undefined = 'at-1';
  let tokenDelayMs = 0;
  let tokenDeadline: AbortSignal | undefined;
  let requests = 0;
  // stands in for Next.js's request scope, which cookies() reads in production (NEXT-API-04)
  const requestScope = new AsyncLocalStorage<string>();

  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
    configureServerFetch(() => ({
      apiBaseUrl: 'http://backend.test',
      timeoutMs: 100,
      accessToken: async (deadline) => {
        tokenDeadline = deadline;
        const scoped = requestScope.getStore();
        await delay(tokenDelayMs);
        return scoped ?? token;
      },
    }));
  });
  afterEach(() => {
    server.resetHandlers();
    token = 'at-1';
    tokenDelayMs = 0;
    requests = 0;
  });
  afterAll(() => {
    server.close();
  });

  it('resolves the URL against the configured base and relays the access token', async () => {
    let authorization: string | null = null;
    server.use(
      http.get('http://backend.test/api/v1/orders', ({ request }) => {
        authorization = request.headers.get('authorization');
        return HttpResponse.json({ items: [] });
      }),
    );

    await expect(customFetch('/api/v1/orders', {})).resolves.toEqual({ items: [] });
    expect(authorization).toBe('Bearer at-1');
  });

  it('throws UnauthenticatedError without a token and sends nothing', async () => {
    token = undefined;
    server.use(
      http.all('*', () => {
        requests += 1;
        return HttpResponse.json({});
      }),
    );

    await expect(customFetch('/api/v1/orders', {})).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(requests).toBe(0);
  });

  it('turns a rejected token into UnauthenticatedError', async () => {
    server.use(http.get('http://backend.test/api/v1/orders', () => new HttpResponse(null, { status: 401 })));

    await expect(customFetch('/api/v1/orders', {})).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('turns a problem body into HttpProblem', async () => {
    server.use(
      http.post('http://backend.test/api/v1/orders/o-3/cancel', () =>
        HttpResponse.json(
          { status: 409, code: 'ORDER_ALREADY_SHIPPED' },
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );

    await expect(customFetch('/api/v1/orders/o-3/cancel', { method: 'POST' })).rejects.toEqual(
      new HttpProblem(409, { status: 409, code: 'ORDER_ALREADY_SHIPPED' }),
    );
  });

  it('times out with a TechnicalError (RES-TMO-03)', async () => {
    server.use(http.get('http://backend.test/api/v1/slow', () => new Promise<never>(() => undefined)));

    await expect(customFetch('/api/v1/slow', {})).rejects.toMatchObject({ failure: 'timeout' });
  });

  it('counts the session lookup and refresh against the same deadline (NEXT-RES-03)', async () => {
    tokenDelayMs = 70; // a slow refresh
    server.use(
      http.get('http://backend.test/api/v1/orders', async () => {
        await delay(60);
        return HttpResponse.json({ items: [] });
      }),
    );

    await expect(customFetch('/api/v1/orders', {})).rejects.toMatchObject({ failure: 'timeout' });
    expect(tokenDeadline).toBeInstanceOf(AbortSignal);
  });

  it('refuses a path that would leave the API, before any request (path steering)', async () => {
    await expect(customFetch('/api/v1/orders/../cancel', { method: 'POST' })).rejects.toBeInstanceOf(TechnicalError);
  });

  it('never follows a redirect with the token', async () => {
    server.use(
      http.get('http://backend.test/api/v1/moved', () => HttpResponse.redirect('http://elsewhere.test/', 302)),
    );

    await expect(customFetch('/api/v1/moved', {})).rejects.toBeInstanceOf(TechnicalError);
  });

  it('relays each concurrent request its own token (NEXT-API-04)', async () => {
    server.use(
      http.get('http://backend.test/api/v1/whoami', async ({ request }) => {
        const authorization = request.headers.get('authorization');
        await delay(authorization === 'Bearer at-alice' ? 30 : 0); // the first request answers last
        return HttpResponse.json({ authorization });
      }),
    );

    const [alice, bob] = await Promise.all([
      requestScope.run('at-alice', () => customFetch('/api/v1/whoami', {})),
      requestScope.run('at-bob', () => customFetch('/api/v1/whoami', {})),
    ]);

    expect([alice, bob]).toEqual([{ authorization: 'Bearer at-alice' }, { authorization: 'Bearer at-bob' }]);
  });
});
