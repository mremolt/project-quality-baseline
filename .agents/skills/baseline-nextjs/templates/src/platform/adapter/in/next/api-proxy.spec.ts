import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockReset } from 'vitest-mock-extended';

import type { ApiCall, ApiRelayUseCase } from '../../../ports/in/api-relay.use-case';
import type { SessionUseCase } from '../../../ports/in/session.use-case';
import { createApiProxy } from './api-proxy';

describe('API proxy route handler', () => {
  const sessions = mock<SessionUseCase>();
  const backend = mock<ApiRelayUseCase>();
  const proxy = createApiProxy(sessions, backend, 50);
  const cookie = { cookie: '__Host-session=s-1' };
  const relayed = (): ApiCall => {
    const request = backend.relay.mock.lastCall?.[1];
    if (!request) throw new Error('nothing relayed');
    return request;
  };

  beforeEach(() => {
    mockReset(sessions);
    mockReset(backend);
    sessions.resolve.calledWith('s-1').mockResolvedValue({ caller: { subject: 'u' }, xsrfToken: 'xt' });
    backend.relay.mockResolvedValue(Response.json({ items: [] }, { headers: { 'set-cookie': 'x=y' } }));
  });

  it('relays a read with the access token and only allow-listed headers', async () => {
    const response = await proxy(
      new Request('https://shop.test/api/v1/orders?page=0', {
        headers: { ...cookie, 'x-forwarded-for': 'client.example' },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(relayed().pathAndQuery).toBe('/api/v1/orders?page=0');
    expect(backend.relay.mock.lastCall?.[0]).toBe('s-1');
    expect([...relayed().headers.keys()]).toEqual([]);
  });

  it('answers 401 when the session has no valid access token', async () => {
    backend.relay.mockResolvedValue(undefined);

    const response = await proxy(new Request('https://shop.test/api/v1/orders', { headers: cookie }));

    expect(response.status).toBe(401);
  });

  it('answers 401 without a session', async () => {
    const response = await proxy(new Request('https://shop.test/api/v1/orders'));

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(backend.relay).not.toHaveBeenCalled();
  });

  it('refuses a mutating call without the XSRF header', async () => {
    const response = await proxy(
      new Request('https://shop.test/api/v1/orders/o-1/cancel', { method: 'POST', headers: cookie }),
    );

    expect(response.status).toBe(403);
    expect(backend.relay).not.toHaveBeenCalled();
  });

  it('forwards a mutating call with the XSRF header, body included', async () => {
    backend.relay.mockResolvedValue(
      Response.json(
        { code: 'ORDER_ALREADY_SHIPPED' },
        { status: 409, headers: { 'content-type': 'application/problem+json' } },
      ),
    );

    const response = await proxy(
      new Request('https://shop.test/api/v1/orders/o-1/cancel', {
        method: 'POST',
        headers: { ...cookie, 'x-xsrf-token': 'xt', 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'abc' }),
      }),
    );

    expect(response.status).toBe(409);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(new TextDecoder().decode(relayed().body)).toBe('{"reason":"abc"}');
  });

  it('gives the session lookup and the relayed call one shared deadline (NEXT-RES-03)', async () => {
    await proxy(new Request('https://shop.test/api/v1/orders', { headers: cookie }));

    const lookupDeadline = sessions.resolve.mock.lastCall?.[1];
    expect(lookupDeadline).toBeInstanceOf(AbortSignal);
    expect(relayed().signal).toBe(lookupDeadline);
  });

  it('answers 504 when the deadline passes before the backend is called', async () => {
    sessions.resolve.mockImplementation(
      (_id, deadline) =>
        new Promise((_, reject) => {
          deadline?.addEventListener('abort', () => {
            reject(deadline.reason as Error);
          });
        }),
    );

    const response = await proxy(new Request('https://shop.test/api/v1/orders', { headers: cookie }));

    expect(response.status).toBe(504);
    expect(backend.relay).not.toHaveBeenCalled();
  });
});
