import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Controller, Get, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
  type JWTVerifyGetKey,
  SignJWT,
  UnsecuredJWT,
} from 'jose';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AUTH_CONFIG, AuthConfig } from '../../../config/platform.config.js';
import type { Caller } from '../../../domain/index.js';
import { CurrentCaller, Public } from './auth.decorators.js';
import { AuthGuard, JWKS } from './auth.guard.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

@Controller('probe')
class ProbeController {
  @Get('me')
  me(@CurrentCaller() caller: Caller): { id: string } {
    return { id: caller.id };
  }

  @Public()
  @Get('open')
  open(): { ok: true } {
    return { ok: true };
  }
}

const cfg = AuthConfig.parse({
  AUTH_ISSUER: 'https://idp.test/realms/test',
  AUTH_AUDIENCE: 'orders-api',
  AUTH_JWKS_URI: 'https://idp.test/realms/test/certs',
});

type Send = (status: number, body: string) => void;

/** A stand-in identity provider whose key set endpoint answers as each test needs. */
function keySetServer(respond: (send: Send) => void): Promise<Server> {
  const server = createServer((_req, res) => {
    respond((status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' }).end(body);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server);
    });
  });
}
const urlOf = (server: Server): URL =>
  new URL(`http://127.0.0.1:${String((server.address() as AddressInfo).port)}/certs`);

describe('AuthGuard (NEST-SEC-01..04, NEST-SEC-14)', () => {
  let app: NestFastifyApplication;
  let privateKey: CryptoKey;
  let jwk: JWK;
  let keySet: JWTVerifyGetKey; // replaced per test: local set by default, a remote set for key-set failures
  let localKeySet: JWTVerifyGetKey;
  const servers: Server[] = [];

  const token = (claims: { iss?: string; aud?: string; exp?: string } = {}): Promise<string> =>
    new SignJWT({ roles: ['user'] })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('user-1')
      .setIssuer(claims.iss ?? cfg.AUTH_ISSUER)
      .setAudience(claims.aud ?? cfg.AUTH_AUDIENCE)
      .setExpirationTime(claims.exp ?? '5m')
      .sign(privateKey);

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
    localKeySet = createLocalJWKSet({ keys: [jwk] });
    keySet = localKeySet;
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        { provide: JWKS, useValue: ((header, input) => keySet(header, input)) satisfies JWTVerifyGetKey },
        { provide: AUTH_CONFIG, useValue: cfg },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterEach(async () => {
    keySet = localKeySet;
    vi.restoreAllMocks();
    await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => s.close(resolve))));
  });
  afterAll(() => app.close());

  const get = (url: string, bearer?: string) =>
    app.inject({ method: 'GET', url, headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });
  const remote = async (respond: Parameters<typeof keySetServer>[0], timeoutDuration = 2000): Promise<void> => {
    const server = await keySetServer(respond);
    servers.push(server);
    keySet = createRemoteJWKSet(urlOf(server), { timeoutDuration });
  };
  const auditEvents = (): unknown[] => {
    const spy = vi.mocked(Logger.prototype.warn);
    return spy.mock.calls.map(([fields]) => (fields as { audit?: string }).audit);
  };

  const late = (send: Send): void => {
    setTimeout(() => {
      send(200, '{"keys":[]}');
    }, 500);
  };
  const answer =
    (status: number, body: string) =>
    (send: Send): void => {
      send(status, body);
    };

  it('accepts a valid token and passes the caller', async () => {
    const res = await get('/probe/me', await token());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: 'user-1' });
  });

  it('rejects a missing token with 401 and a bare Bearer challenge (RFC 6750)', async () => {
    vi.spyOn(Logger.prototype, 'warn');
    const res = await get('/probe/me');
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(auditEvents()).toContain('auth.token_missing');
  });

  it('rejects foreign-audience, foreign-issuer and expired tokens with 401 and error="invalid_token"', async () => {
    vi.spyOn(Logger.prototype, 'warn');
    for (const bearer of [
      await token({ aud: 'other-api' }),
      await token({ iss: 'https://evil.test' }),
      await token({ exp: '-1m' }),
    ]) {
      const res = await get('/probe/me', bearer);
      expect(res.statusCode).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
    }
    expect(auditEvents()).toEqual(['auth.token_rejected', 'auth.token_rejected', 'auth.token_rejected']);
  });

  it('rejects alg none, an algorithm outside the list and a key not in the set with 401 (NEST-SEC-04)', async () => {
    const none = new UnsecuredJWT({ roles: ['user'] })
      .setSubject('user-1')
      .setIssuer(cfg.AUTH_ISSUER)
      .setAudience(cfg.AUTH_AUDIENCE)
      .setExpirationTime('5m')
      .encode();
    const signed = (alg: string, kid: string, key: CryptoKey | Uint8Array): Promise<string> =>
      new SignJWT({ roles: ['user'] })
        .setProtectedHeader({ alg, kid })
        .setSubject('user-1')
        .setIssuer(cfg.AUTH_ISSUER)
        .setAudience(cfg.AUTH_AUDIENCE)
        .setExpirationTime('5m')
        .sign(key);
    const hs256 = await signed('HS256', 'k1', new TextEncoder().encode('a-shared-secret-of-at-least-32-bytes'));
    const unknownKey = await signed('RS256', 'k2', (await generateKeyPair('RS256')).privateKey);
    for (const bearer of [none, hs256, unknownKey]) {
      const res = await get('/probe/me', bearer);
      expect(res.statusCode).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
    }
  });

  it('accepts a token verified against the remote key set and rejects an unknown kid there with 401', async () => {
    await remote(answer(200, JSON.stringify({ keys: [jwk] })));
    expect((await get('/probe/me', await token())).statusCode).toBe(200);
    const unknownKey = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k9' })
      .setSubject('user-1')
      .setIssuer(cfg.AUTH_ISSUER)
      .setAudience(cfg.AUTH_AUDIENCE)
      .setExpirationTime('5m')
      .sign((await generateKeyPair('RS256')).privateKey);
    expect((await get('/probe/me', unknownKey)).statusCode).toBe(401);
  });

  it.each([
    ['a key set timeout', late],
    ['an HTTP error of the key set endpoint', answer(500, '')],
    ['a key set that is no JSON', answer(200, '<html>')],
    ['an invalid key set', answer(200, '{"keys":"none"}')],
  ])('answers %s with 503 and Retry-After, never 401 (NEST-SEC-04)', async (_case, respond) => {
    vi.spyOn(Logger.prototype, 'warn');
    await remote(respond, 100);
    const res = await get('/probe/me', await token());
    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('5');
    expect(res.headers['www-authenticate']).toBeUndefined();
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(auditEvents()).toContain('auth.key_set_unavailable');
    expect(auditEvents()).not.toContain('auth.token_rejected');
  });

  it('answers an unreachable key set endpoint with 503', async () => {
    const server = await keySetServer(() => undefined);
    const url = urlOf(server);
    await new Promise((resolve) => server.close(resolve));
    keySet = createRemoteJWKSet(url, { timeoutDuration: 1000 });
    const res = await get('/probe/me', await token());
    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('5');
  });

  it('lets public endpoints through without a token', async () => {
    expect((await get('/probe/open')).statusCode).toBe(200);
  });
});
