import { createRequire } from 'node:module';

import { cruise } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { forbidden, options } = require('../.dependency-cruiser.cjs') as {
  forbidden: unknown[];
  options: Record<string, unknown>;
};

describe('architecture rules', () => {
  it('reject a type-only import of an adapter into the domain (NODE-ARCH-14)', async () => {
    const result = await cruise(['src'], {
      ...options,
      ruleSet: { forbidden },
      validate: true,
      baseDir: 'test/fixtures/arch-violation',
    } as never);
    const output = result.output as { summary: { violations: { rule: { name: string } }[] } };
    expect(output.summary.violations.map((v) => v.rule.name)).toContain('domain-is-pure');
  });
});
