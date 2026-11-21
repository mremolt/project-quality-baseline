import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { configSchemas } from './config-schemas.js';
import { describeKeys } from './platform/config/load-config.js';

interface Key {
  key: string;
  required: boolean;
  secret: boolean;
}

describe('configuration keys (TEST-CFG-03, TEST-CFG-04)', () => {
  it('lists exactly the keys the code defines', () => {
    const own = configSchemas.flatMap(describeKeys);
    const listed = parse(readFileSync('configuration-keys.yaml', 'utf8')) as Key[];
    const libraryKey = (key: string): boolean => /^(OTEL_|NODE_)/.test(key);
    const pick = ({ key, required, secret }: Key): Key => ({ key, required, secret });
    const byKey = (a: Key, b: Key): number => a.key.localeCompare(b.key);
    expect(
      listed
        .filter((k) => !libraryKey(k.key))
        .map(pick)
        .sort(byKey),
    ).toEqual(own.map(pick).sort(byKey));
  });

  it('builds every secret-named key with secret() (NEST-CFG-08)', () => {
    const secretName = /PASSWORD|SECRET|TOKEN|API_KEY|CREDENTIAL/;
    const plain = configSchemas
      .flatMap(describeKeys)
      .filter((k) => secretName.test(k.key) && !k.secret)
      .map((k) => k.key);
    expect(plain).toEqual([]);
  });

  it('marks every secret-named key in configuration-keys.yaml as secret', () => {
    const listed = parse(readFileSync('configuration-keys.yaml', 'utf8')) as Key[];
    expect(listed.filter((k) => /PASSWORD|SECRET|TOKEN|API_KEY|CREDENTIAL/.test(k.key) && !k.secret)).toEqual([]);
  });
});
