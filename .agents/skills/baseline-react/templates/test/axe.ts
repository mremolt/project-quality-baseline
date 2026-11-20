import axe from 'axe-core';
import { expect } from 'vitest';

/** TS-TEST-09: every component test runs axe on its main rendered states. */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const { violations } = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false }, // no layout in jsdom; checked in E2E (L4)
      'target-size': { enabled: false }, // same; a jsdom run would report a false pass (TS-TEST-21)
    },
  });
  expect(violations).toEqual([]);
}
