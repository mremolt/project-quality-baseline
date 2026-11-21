import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { describeKeys } from './server-config';

interface Key {
  key: string;
  required: boolean;
  secret: boolean;
}

// Keys Next.js, Node.js and OpenTelemetry read themselves; listed for the deployment, not in the schema
const libraryKey = (key: string): boolean => /^(OTEL_|NODE_|PORT$|HOSTNAME$)/.test(key);
const pick = ({ key, required, secret }: Key): Key => ({ key, required, secret });
const byKey = (a: Key, b: Key): number => a.key.localeCompare(b.key);

describe('configuration-keys.yaml (TEST-CFG-04, NEXT-CFG-09)', () => {
  it('lists exactly the keys of the server schema, with required and secret', () => {
    const listed = parse(readFileSync('configuration-keys.yaml', 'utf8')) as Key[];

    expect(
      listed
        .filter((k) => !libraryKey(k.key))
        .map(pick)
        .sort(byKey),
    ).toEqual(describeKeys().map(pick).sort(byKey));
  });
});
