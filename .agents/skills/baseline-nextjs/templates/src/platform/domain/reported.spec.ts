import { describe, expect, it } from 'vitest';

import { markReported, wasReported } from './reported';
import { TechnicalError } from './technical-error';

describe('reported errors (TS-ARCH-18, NEXT-OBS-09)', () => {
  it('knows an error once it is marked', () => {
    const error = new TechnicalError('down', { failure: 'server' });
    expect(wasReported(error)).toBe(false);

    markReported(error);

    expect(wasReported(error)).toBe(true);
  });

  it('counts an error as reported when one of its causes was', () => {
    const reported = new Error('backend answered 503');
    markReported(reported);

    expect(wasReported(new TechnicalError('orders API failed', { cause: reported, failure: 'server' }))).toBe(true);
  });

  it('keeps the mark out of the enumerable properties, so logs and serialization do not change', () => {
    const error = new Error('boom');
    markReported(error);

    expect(Object.keys(error)).toEqual([]);
    expect(JSON.stringify(error)).toBe('{}');
  });

  it('treats values that are not objects as never reported', () => {
    markReported('plain string');

    expect(wasReported('plain string')).toBe(false);
    expect(wasReported(undefined)).toBe(false);
  });

  it('stops at a cause cycle', () => {
    const first = new Error('first');
    const second = new Error('second', { cause: first });
    Object.defineProperty(first, 'cause', { value: second });

    expect(wasReported(first)).toBe(false);
  });
});
