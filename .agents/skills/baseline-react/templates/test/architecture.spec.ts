import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { cruise, type ICruiseOptions, type IForbiddenRuleType, type IReporterOutput } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
// The config is CommonJS; this is the part of dependency-cruiser's config type it uses.
const config = require('../.dependency-cruiser.cjs') as { forbidden: IForbiddenRuleType[]; options: ICruiseOptions };

// An absolute baseDir: with a relative one, bare imports (react, zod) stay unresolved and match rules by accident.
const fixture = fileURLToPath(new URL('fixtures/arch-violation', import.meta.url));
const project = fileURLToPath(new URL('..', import.meta.url));

async function violationsIn(baseDir: string): Promise<string[]> {
  const result: IReporterOutput = await cruise(['src'], {
    ...config.options,
    ruleSet: { forbidden: config.forbidden },
    validate: true,
    baseDir,
  });
  if (typeof result.output === 'string') throw new Error('expected a JSON cruise result');
  return result.output.summary.violations.map((violation) => violation.rule.name);
}

describe('architecture rules (TS-ARCH-13: the checker does not check nothing)', () => {
  it('rejects a type-only import of generated code into the domain', async () => {
    expect(await violationsIn(fixture)).toContain('domain-is-pure');
  });

  it('rejects a routes file that imports the composition statically', async () => {
    expect(await violationsIn(fixture)).toContain('feature-routes-load-feature-lazily');
  });

  it('rejects a published feature API that imports the UI adapter', async () => {
    expect(await violationsIn(fixture)).toContain('feature-api-without-ui');
  });

  it('passes on the real sources', async () => {
    expect(await violationsIn(project)).toEqual([]);
  });
});
