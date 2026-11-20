import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HttpRuntimeConfig, RuntimeConfigSchema } from './http-runtime-config';

const valid = {
  environment: 'test',
  release: '1.2.3',
  requestTimeoutMs: 10_000,
  loginPath: '/login',
  errorReporting: { enabled: true, path: '/api/client-errors' },
};
const server = setupServer();

describe('RuntimeConfigSchema (TEST-CFG-01)', () => {
  it('accepts a valid file', () => {
    expect(RuntimeConfigSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    ['a missing field', { ...valid, environment: undefined }],
    ['a missing release', { ...valid, release: undefined }],
    ['a non-positive timeout', { ...valid, requestTimeoutMs: 0 }],
    ['an absolute login URL', { ...valid, loginPath: 'https://evil.example/login' }],
    ['a protocol-relative reporting path', { ...valid, errorReporting: { enabled: true, path: '//evil.example' } }],
  ])('rejects %s', (_case, config) => {
    expect(RuntimeConfigSchema.safeParse(config).success).toBe(false);
  });
});

describe('HttpRuntimeConfig', () => {
  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });

  it('loads, validates and freezes the configuration', async () => {
    server.use(http.get('*/config.json', () => HttpResponse.json(valid)));

    const config = await new HttpRuntimeConfig().loadRuntimeConfig();

    expect(config).toEqual(valid);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('rejects a non-2xx answer', async () => {
    server.use(http.get('*/config.json', () => new HttpResponse(null, { status: 404 })));

    await expect(new HttpRuntimeConfig().loadRuntimeConfig()).rejects.toThrow('config.json: HTTP 404');
  });
});
