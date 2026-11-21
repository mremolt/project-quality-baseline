import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = fileURLToPath(new URL('../src', import.meta.url));

describe('one build for every environment (NEXT-CFG-01, CFG-02)', () => {
  it('has no .env file that next build would load', () => {
    // .env.development is committed and only `next dev` loads it (NEXT-DEV-03)
    expect(readdirSync(root).filter((name) => /^\.env(\.production)?(\.local)?$/.test(name))).toEqual([]);
  });

  it('reads no NEXT_PUBLIC_ variables in src', () => {
    const offenders = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => /NEXT_PUBLIC_[A-Z0-9]/.test(readFileSync(`${src}/${file}`, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
