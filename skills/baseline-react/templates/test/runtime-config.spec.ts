import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = fileURLToPath(new URL('../src', import.meta.url));

describe('one build for every environment (REACT-CFG-01, CFG-02)', () => {
  it('has no .env files in the frontend folder', () => {
    expect(readdirSync(root).filter((name) => name.startsWith('.env'))).toEqual([]);
  });

  it('reads no VITE_ variables in src', () => {
    const offenders = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => readFileSync(`${src}/${file}`, 'utf8').includes('import.meta.env.VITE_'));
    expect(offenders).toEqual([]);
  });
});
