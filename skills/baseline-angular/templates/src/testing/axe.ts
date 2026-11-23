import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * TS-TEST-09: axe on a rendered component in jsdom. Colour contrast and target size need layout, which jsdom lacks
 * (target-size would report a false pass, TS-TEST-21); both are asserted in E2E. Lives in src/testing, which is
 * treated like a spec file by the dependency rules (TS-ARCH-12).
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const { violations } = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
      'target-size': { enabled: false },
    },
  });
  expect(violations).toEqual([]);
}
