import { Writable } from 'node:stream';
import { inspect } from 'node:util';

import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { Secret } from './secret.js';

describe('Secret (CFG-07, NEST-CFG-08, TEST-CFG-03)', () => {
  const value = 'very-secret-value';
  const holder = { password: new Secret(value) };

  it('masks every printing path', () => {
    expect(String(holder.password)).toBe('***');
    expect(`password=${holder.password.toString()}`).toBe('password=***');
    expect(JSON.stringify(holder)).toBe('{"password":"***"}');
    expect(inspect(holder)).not.toContain(value);
    expect(Object.keys(holder.password)).toEqual([]); // nothing for a spread to copy
  });

  it('never reaches a pino line', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    pino(sink).info({ config: holder }, 'started');
    expect(lines.join('')).toContain('"password":"***"');
    expect(lines.join('')).not.toContain(value);
  });

  it('reveals the value only on request and rejects a blank one', () => {
    expect(holder.password.reveal()).toBe(value);
    expect(() => new Secret('  ')).toThrow('secret must not be blank');
  });
});
