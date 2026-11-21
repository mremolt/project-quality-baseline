import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FetchBackendRelay } from './fetch-backend-relay';

describe('FetchBackendRelay', () => {
  const server = setupServer();
  const relay = new FetchBackendRelay('http://backend.test', 100);
  const request = (pathAndQuery: string) => ({
    method: 'GET',
    pathAndQuery,
    headers: new Headers({ authorization: 'Bearer at-1' }),
    body: undefined,
    signal: new AbortController().signal,
  });

  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });

  it('calls the backend below its base URL with the given headers', async () => {
    let authorization: string | null = null;
    server.use(
      http.get('http://backend.test/api/v1/orders', ({ request: r }) => {
        authorization = r.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    const response = await relay.relay(request('/api/v1/orders?page=0'));

    expect(await response.json()).toEqual({ ok: true });
    expect(authorization).toBe('Bearer at-1');
  });

  it('answers 504 when the backend does not answer in time', async () => {
    server.use(http.get('http://backend.test/api/v1/slow', () => new Promise<never>(() => undefined)));

    expect((await relay.relay(request('/api/v1/slow'))).status).toBe(504);
  });

  it('answers 502 when the backend redirects', async () => {
    server.use(
      http.get('http://backend.test/api/v1/moved', () => HttpResponse.redirect('http://elsewhere.test/', 302)),
    );

    expect((await relay.relay(request('/api/v1/moved'))).status).toBe(502);
  });
});
