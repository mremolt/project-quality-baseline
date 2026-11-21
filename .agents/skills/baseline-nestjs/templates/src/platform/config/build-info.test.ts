import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readBuildInfo } from './build-info.js';

describe('readBuildInfo (NEST-REL-06)', () => {
  const file = (content?: string): URL => {
    const path = join(mkdtempSync(join(tmpdir(), 'build-info-')), 'build-info.json');
    if (content !== undefined) writeFileSync(path, content);
    return pathToFileURL(path);
  };

  it('reads the commit the image build wrote', () => {
    expect(readBuildInfo(file('{"commit":"3f2a9c1"}\n'))).toEqual({ commit: '3f2a9c1' });
  });

  it('answers unknown outside an image build (watch mode, tests)', () => {
    expect(readBuildInfo(file())).toEqual({ commit: 'unknown' });
  });

  it('fails on a malformed file instead of hiding a broken build', () => {
    expect(() => readBuildInfo(file('{"sha":1}'))).toThrow('build-info.json');
  });
});
