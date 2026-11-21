import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { cruise, type ICruiseOptions, type IForbiddenRuleType, type IReporterOutput } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
// The config is CommonJS; this is the part of dependency-cruiser's config type it uses.
const config = require('../.dependency-cruiser.cjs') as { forbidden: IForbiddenRuleType[]; options: ICruiseOptions };

// An absolute baseDir: with a relative one, bare imports stay unresolved and match rules by accident (REACT-TEST-17).
const fixture = fileURLToPath(new URL('fixtures/arch-violation', import.meta.url));
const project = fileURLToPath(new URL('..', import.meta.url));

interface Violation {
  readonly from: string;
  readonly rule: { readonly name: string };
}

async function violationsIn(baseDir: string): Promise<readonly Violation[]> {
  const result: IReporterOutput = await cruise(['src'], {
    ...config.options,
    ruleSet: { forbidden: config.forbidden },
    validate: true,
    baseDir,
  });
  if (typeof result.output === 'string') throw new Error('expected a JSON cruise result');
  return result.output.summary.violations;
}

const rulesFrom = async (from: string) =>
  (await violationsIn(fixture)).filter((v) => v.from === from).map((v) => v.rule.name);

describe('architecture rules fail on their canaries (TS-ARCH-13, NEXT-TEST-17)', () => {
  it('reports a type-only import of generated code into the domain', async () => {
    expect(await rulesFrom('src/features/orders/domain/order.ts')).toContain('domain-is-pure');
  });

  it('reports a client file importing a server-only module', async () => {
    expect(await rulesFrom('src/features/orders/adapter/in/ui/orders-panel.client.tsx')).toContain(
      'client-never-imports-server-only',
    );
  });

  it('reports a server component importing the client platform entry', async () => {
    expect(await rulesFrom('src/features/orders/adapter/in/ui/orders-screen.server.tsx')).toContain(
      'server-never-imports-client-entry',
    );
  });

  it("cannot see the 'use client' directive of a file without the .client suffix (ESLint covers it)", async () => {
    expect(await rulesFrom('src/features/orders/adapter/in/ui/orders-widget.tsx')).not.toContain(
      'client-never-imports-server-only',
    );
  });

  it('reports a route file importing anything but a pages file, an index or the framework', async () => {
    expect(await rulesFrom('src/app/orders/page.tsx')).toEqual(
      expect.arrayContaining(['app-route-files-are-thin', 'generated-api-only-in-http-adapter']),
    );
  });

  it('passes on the real sources', async () => {
    expect(await violationsIn(project)).toEqual([]);
  });
});
