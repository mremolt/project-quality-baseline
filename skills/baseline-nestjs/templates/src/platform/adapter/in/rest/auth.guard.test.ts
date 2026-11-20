import { Controller, Get } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

describe('AuthGuard (NEST-SEC-01..04, NEST-SEC-14)', () => {
  let app: NestFastifyApplication;
  let privateKey: CryptoKey;

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
    const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        { provide: JWKS, useValue: createLocalJWKSet({ keys: [jwk] }) },
        { provide: AUTH_CONFIG, useValue: cfg },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(() => app.close());

  const get = async (url: string, bearer?: string): Promise<number> =>
    (await app.inject({ method: 'GET', url, headers: bearer ? { authorization: `Bearer ${bearer}` } : {} })).statusCode;

  it('accepts a valid token and passes the caller', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/probe/me',
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: 'user-1' });
  });

  it('rejects missing, foreign-audience, foreign-issuer and expired tokens with 401', async () => {
    expect(await get('/probe/me')).toBe(401);
    expect(await get('/probe/me', await token({ aud: 'other-api' }))).toBe(401);
    expect(await get('/probe/me', await token({ iss: 'https://evil.test' }))).toBe(401);
    expect(await get('/probe/me', await token({ exp: '-1m' }))).toBe(401);
  });

  it('lets public endpoints through without a token', async () => {
    expect(await get('/probe/open')).toBe(200);
  });
});
