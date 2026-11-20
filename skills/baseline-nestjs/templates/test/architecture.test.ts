import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { cruise } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { forbidden, options } = require('../.dependency-cruiser.cjs') as {
  forbidden: unknown[];
  options: Record<string, unknown>;
};
// Absolute: with a relative baseDir, bare imports (zod, @nestjs/*) stay unresolved and can match rules by accident.
const fixture = fileURLToPath(new URL('fixtures/arch-violation', import.meta.url));

describe('architecture rules', () => {
  it('reject a type-only import of an adapter into the domain (NODE-ARCH-14)', async () => {
    const result = await cruise(['src'], {
      ...options,
      ruleSet: { forbidden },
      validate: true,
      baseDir: fixture,
    } as never);
    const output = result.output as { summary: { violations: { rule: { name: string } }[] } };
    expect(output.summary.violations.map((v) => v.rule.name)).toContain('domain-is-pure');
  });
});
