import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { TechnicalError } from '../../../domain';
import { sendRequest } from './send-request';

describe('sendRequest', () => {
  const server = setupServer();
  const url = 'http://api.test/api/v1/slow';

  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });

  it('turns a time-out into a TechnicalError', async () => {
    server.use(http.get(url, () => new Promise<never>(() => undefined)));

    await expect(sendRequest(url, {}, { timeoutMs: 50, headers: {} })).rejects.toBeInstanceOf(TechnicalError);
  });

  it("passes the caller's abort through unchanged", async () => {
    server.use(http.get(url, () => new Promise<never>(() => undefined)));
    const controller = new AbortController();

    const pending = sendRequest(url, { signal: controller.signal }, { timeoutMs: 5_000, headers: {} });
    controller.abort();

    await expect(pending).rejects.toHaveProperty('name', 'AbortError');
  });

  it('returns the parsed JSON body', async () => {
    server.use(http.get(url, () => HttpResponse.json({ a: 1 })));

    await expect(sendRequest(url, {}, { timeoutMs: 1_000, headers: { authorization: 'Bearer t' } })).resolves.toEqual({
      a: 1,
    });
  });
});
