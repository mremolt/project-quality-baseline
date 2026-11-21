import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseConfig, secret } from './load-config.js';
import { Secret } from './secret.js';

const Schema = z.object({
  DEMO_URL: z.url().describe('URL'),
  DEMO_TIMEOUT_MS: z.coerce.number().int().min(100).default(1000).describe('Timeout'),
  DEMO_PASSWORD: secret().describe('Password'),
});

describe('parseConfig (NEST-CFG-02, NEST-CFG-07, TEST-CFG-01)', () => {
  const valid = { DEMO_URL: 'https://demo.test', DEMO_PASSWORD: 'pw-value' };

  it('binds valid values, applies defaults and freezes the result', () => {
    const cfg = parseConfig(Schema, valid);
    expect(cfg.DEMO_URL).toBe('https://demo.test');
    expect(cfg.DEMO_TIMEOUT_MS).toBe(1000);
    expect(cfg.DEMO_PASSWORD).toBeInstanceOf(Secret);
    expect(cfg.DEMO_PASSWORD.reveal()).toBe('pw-value');
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  it('names every bad key, never a value', () => {
    const run = (): unknown => parseConfig(Schema, { DEMO_URL: 'not-a-url-secret-ish', DEMO_TIMEOUT_MS: '5' });
    expect(run).toThrow(/^Invalid configuration: .*DEMO_URL.*DEMO_TIMEOUT_MS.*DEMO_PASSWORD/);
    expect(run).not.toThrow(/not-a-url-secret-ish/);
  });

  it('reads a secret from KEY_FILE and trims the trailing newline', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'cfg-')), 'password');
    writeFileSync(file, 'from-file\n');
    const cfg = parseConfig(Schema, { DEMO_URL: valid.DEMO_URL, DEMO_PASSWORD_FILE: file });
    expect(cfg.DEMO_PASSWORD.reveal()).toBe('from-file');
  });

  it('refuses a secret shorter than its minimum length, naming the key only (NEST-CFG-12)', () => {
    const Signed = z.object({ DEMO_SIGNING_SECRET: secret(32).describe('Signing secret') });
    const run = (value: string): unknown => parseConfig(Signed, { DEMO_SIGNING_SECRET: value });
    expect(() => run('too-short')).toThrow('Invalid configuration: DEMO_SIGNING_SECRET');
    expect(() => run('x'.repeat(32))).not.toThrow();
  });

  it('fails when KEY and KEY_FILE are both set, or KEY_FILE is unreadable', () => {
    expect(() => parseConfig(Schema, { ...valid, DEMO_PASSWORD_FILE: '/nonexistent' })).toThrow(
      'DEMO_PASSWORD (set both DEMO_PASSWORD and DEMO_PASSWORD_FILE)',
    );
    expect(() => parseConfig(Schema, { DEMO_URL: valid.DEMO_URL, DEMO_PASSWORD_FILE: '/nonexistent' })).toThrow(
      'DEMO_PASSWORD_FILE (unreadable)',
    );
  });
});
