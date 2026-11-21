import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Logger } from '@nestjs/common';
import { Agent, fetch } from 'undici';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { transactionGuard } from './transaction-guard.js';

describe('transactionGuard (NEST-RES-03, RES-TX-01)', () => {
  let server: Server;
  let url: string;
  const calls: string[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      calls.push(req.url ?? '');
      res.end('ok');
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const call = async (mode: 'fail' | 'warn', inTransaction: boolean, path: string): Promise<string> => {
    const agent = new Agent({ connectTimeout: 1000 }).compose(transactionGuard(mode, () => inTransaction));
    try {
      const res = await fetch(`${url}${path}`, { dispatcher: agent, signal: AbortSignal.timeout(1000) });
      return await res.text();
    } finally {
      await agent.close();
    }
  };

  it('lets calls outside a transaction through in both modes', async () => {
    expect(await call('fail', false, '/a')).toBe('ok');
    expect(await call('warn', false, '/b')).toBe('ok');
  });

  it('refuses a call inside a transaction in fail mode, before it reaches the server', async () => {
    await expect(call('fail', true, '/c')).rejects.toThrow();
    expect(calls).not.toContain('/c');
  });

  it('logs a warning and lets the call through in warn mode', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    expect(await call('warn', true, '/d')).toBe('ok');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('remote call inside a transaction: GET'));
    warn.mockRestore();
  });
});
