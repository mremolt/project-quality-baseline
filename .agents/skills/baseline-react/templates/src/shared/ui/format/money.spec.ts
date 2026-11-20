import { describe, expect, it } from 'vitest';

import { formatMoney } from './money';

describe('formatMoney (TEST-I18N-07)', () => {
  const money = { amount: '1234567.10', currency: 'EUR' };

  it('formats for en', () => {
    expect(formatMoney('en', money)).toBe('€1,234,567.10');
  });

  it('formats for de', () => {
    expect(formatMoney('de', money)).toBe('1.234.567,10 €');
  });

  it('keeps digits a float would lose', () => {
    expect(formatMoney('en', { amount: '90071992547409.93', currency: 'EUR' })).toBe('€90,071,992,547,409.93');
  });
});
