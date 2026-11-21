import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockReset } from 'vitest-mock-extended';

import type { ClientErrorIntakeUseCase } from '../../../ports/in/client-error-intake.use-case';
import { createClientErrorRouteHandler } from './client-error-route-handler';

const APP_ORIGIN = 'https://shop.test';
const report = {
  type: 'TechnicalError',
  message: 'request failed',
  stack: 'TechnicalError: request failed\n    at a.js:1:2',
  release: '1.2.3',
  environment: 'prod',
  route: '/orders',
  status: 503,
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
};

function post(body: string, headers: Record<string, string> = { origin: APP_ORIGIN }): Request {
  return new Request(`${APP_ORIGIN}/client-errors`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

describe('client error route handler (NEXT-OBS-18)', () => {
  const intake = mock<ClientErrorIntakeUseCase>();
  let now = 0;
  const handler = createClientErrorRouteHandler(intake, {
    appOrigin: APP_ORIGIN,
    maxBodyBytes: 4_096,
    maxReportsPerMinute: 3,
    now: () => now,
  });

  beforeEach(() => {
    mockReset(intake);
    now += 60_000; // a fresh rate-limit window per test
  });

  it('accepts a same-origin report without a session and answers 204', async () => {
    const response = await handler(post(JSON.stringify(report)));

    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(intake.accept).toHaveBeenCalledWith(report);
  });

  it('accepts Sec-Fetch-Site same-origin and a report with the optional fields left out', async () => {
    const minimal = { type: 'Error', message: 'boom', release: '1.2.3', environment: 'prod', route: '/' };

    const response = await handler(post(JSON.stringify(minimal), { 'sec-fetch-site': 'same-origin' }));

    expect(response.status).toBe(204);
    expect(intake.accept).toHaveBeenCalledWith({ ...minimal, stack: undefined, status: undefined, traceId: undefined });
  });

  it.each([
    ['no Origin', {}],
    ['a foreign Origin', { origin: 'https://evil.example' }],
    ['Origin null', { origin: 'null' }],
    ['Sec-Fetch-Site cross-site', { 'sec-fetch-site': 'cross-site' }],
  ])('refuses a report with %s (403)', async (_, headers) => {
    const response = await handler(post(JSON.stringify(report), headers));

    expect(response.status).toBe(403);
    expect(intake.accept).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON (415)', async () => {
    const response = await handler(post(JSON.stringify(report), { origin: APP_ORIGIN, 'content-type': 'text/plain' }));

    expect(response.status).toBe(415);
  });

  it('truncates an over-long message to its field limit', async () => {
    await handler(post(JSON.stringify({ ...report, message: 'x'.repeat(2_100) }), { origin: APP_ORIGIN }));

    expect(intake.accept.mock.lastCall?.[0].message).toHaveLength(2_000);
  });

  it('refuses a body over the limit, also without Content-Length (413)', async () => {
    const big = JSON.stringify({ ...report, stack: 'x'.repeat(5_000) });
    const streamed = new Request(`${APP_ORIGIN}/client-errors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: APP_ORIGIN },
      body: new Blob([big]).stream(),
      duplex: 'half', // Node.js needs it for a stream body; not in the DOM RequestInit type
    } as RequestInit);

    expect((await handler(post(big))).status).toBe(413);
    expect((await handler(streamed)).status).toBe(413);
    expect(intake.accept).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', '{"type":'],
    ['an unknown key', JSON.stringify({ ...report, cookie: 'session=1' })],
    ['a missing field', JSON.stringify({ ...report, message: undefined })],
    ['a trace id with markup', JSON.stringify({ ...report, traceId: '<script>' })],
    ['an absolute route', JSON.stringify({ ...report, route: 'https://evil.example/' })],
  ])('refuses %s (400)', async (_, body) => {
    const response = await handler(post(body));

    expect(response.status).toBe(400);
    expect(intake.accept).not.toHaveBeenCalled();
  });

  it('limits the reports per instance and minute (429) and opens the next window', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await handler(post(JSON.stringify(report)))).status);

    expect(statuses).toEqual([204, 204, 204, 429]);
    now += 60_000;
    expect((await handler(post(JSON.stringify(report)))).status).toBe(204);
  });

  it('answers 429 with Retry-After', async () => {
    for (let i = 0; i < 3; i++) await handler(post(JSON.stringify(report)));

    const response = await handler(post(JSON.stringify(report)));

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
  });
});
