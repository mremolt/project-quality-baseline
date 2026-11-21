import { setTimeout } from 'node:timers/promises';

import { Controller, Get, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BusinessRuleError, UnavailableError } from '../../../domain/index.js';
import { InvalidTokenException } from './auth.guard.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

class OrderAlreadyShipped extends BusinessRuleError {
  constructor() {
    super('ORDER_ALREADY_SHIPPED', 'Order already shipped');
  }
}

@Controller('probe')
class ProbeController {
  @Get('business')
  business(): never {
    throw new OrderAlreadyShipped();
  }

  @Get('not-ready')
  notReady(): never {
    throw new ServiceUnavailableException({ status: 'error', details: { database: { status: 'down' } } });
  }

  @Get('slow')
  async slow(): Promise<{ ok: true }> {
    await setTimeout(300); // longer than the handlerTimeout below
    return { ok: true };
  }

  @Get('pool-exhausted')
  poolExhausted(): never {
    throw new UnavailableError('database pool exhausted', 1);
  }

  @Get('no-token')
  noToken(): never {
    throw new UnauthorizedException();
  }

  @Get('bad-token')
  badToken(): never {
    throw new InvalidTokenException();
  }

  @Get('rate-limited')
  rateLimited(): never {
    throw Object.assign(new Error('Rate limit exceeded, retry in 1 minute'), { statusCode: 429 });
  }

  @Get('missing')
  missing(): never {
    throw new NotFoundException('secret detail');
  }

  @Get('bug')
  bug(): never {
    throw new TypeError('internal detail');
  }
}

describe('ProblemDetailsFilter (NEST-REST-14)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    // The real Fastify handlerTimeout (NEST-SEC-22), not a simulated error
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ handlerTimeout: 100 }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(() => app.close());

  const get = (url: string) => app.inject({ method: 'GET', url });

  it('answers a business rule error with 409 and its code', async () => {
    const res = await get('/probe/business');
    expect(res.statusCode).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 409, code: 'ORDER_ALREADY_SHIPPED', title: 'Conflict' });
  });

  it('passes 503 through with Retry-After and without the health details (NEST-OBS-03)', async () => {
    for (const url of ['/probe/not-ready', '/probe/slow']) {
      const res = await get(url);
      expect(res.statusCode).toBe(503);
      expect(res.headers['retry-after']).toBe('5');
      expect(res.body).not.toContain('database');
    }
  });

  it('answers UnavailableError with 503 and its Retry-After', async () => {
    const res = await get('/probe/pool-exhausted');
    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('1');
    expect(res.json()).toEqual({ status: 503, title: 'Service Unavailable' });
  });

  it('adds the Bearer challenge to every 401, with error="invalid_token" for a rejected token (RFC 6750)', async () => {
    const missing = await get('/probe/no-token');
    expect(missing.statusCode).toBe(401);
    expect(missing.headers['www-authenticate']).toBe('Bearer');
    const rejected = await get('/probe/bad-token');
    expect(rejected.statusCode).toBe(401);
    expect(rejected.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
  });

  it('keeps the status of a plugin error without its message', async () => {
    const res = await get('/probe/rate-limited');
    expect(res.statusCode).toBe(429);
    expect(res.body).not.toContain('Rate limit');
  });

  it('never sends an exception message', async () => {
    const missing = await get('/probe/missing');
    expect(missing.statusCode).toBe(404);
    expect(missing.body).not.toContain('secret detail');
    const bug = await get('/probe/bug');
    expect(bug.statusCode).toBe(500);
    expect(bug.json()).toEqual({ status: 500, title: 'Internal Server Error' });
  });
});
