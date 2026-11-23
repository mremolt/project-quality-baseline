import { describe, expect, it, vi } from 'vitest';

import { IcuTranspiler } from './icu-transpiler';

function transpile(lang: string, value: string, params?: Record<string, unknown>): unknown {
  const transpiler = new IcuTranspiler();
  transpiler.onLangChanged(lang);
  return transpiler.transpile(
    params ? { value, params, translation: {}, key: 'k' } : { value, translation: {}, key: 'k' },
  );
}

describe('IcuTranspiler', () => {
  it('replaces parameters and leaves plain text alone', () => {
    expect(transpile('en', 'Hello {name},', { name: 'Alex' })).toBe('Hello Alex,');
    expect(transpile('de', 'Ohne Parameter')).toBe('Ohne Parameter');
  });

  it('applies plural rules of the language (NG-I18N-06)', () => {
    const message = '{count, plural, =0 {No entries} one {# entry} other {# entries}}';

    expect(transpile('en', message, { count: 0 })).toBe('No entries');
    expect(transpile('en', message, { count: 1 })).toBe('1 entry');
    expect(transpile('en', message, { count: 1500 })).toBe('1,500 entries');
    expect(transpile('de', '{count, plural, one {# Eintrag} other {# Einträge}}', { count: 1500 })).toBe(
      '1.500 Einträge',
    );
  });

  it('never compiles code at runtime (the CSP forbids it, NG-SEC-05)', () => {
    const forbidden = vi.fn(() => {
      throw new Error('eval used');
    });
    vi.stubGlobal('Function', forbidden);
    try {
      expect(transpile('en', '{n, plural, one {# a} other {# b}}', { n: 2 })).toBe('2 b');
    } finally {
      vi.unstubAllGlobals();
    }
    expect(forbidden).not.toHaveBeenCalled();
  });
});
