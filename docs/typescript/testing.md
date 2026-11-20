# TypeScript Testing

How the shared testing rules ([testing-by-architecture-element.md](../shared/testing/testing-by-architecture-element.md), [tdd.md](../shared/testing/tdd.md), [wcag.md](../shared/accessibility/wcag.md)) are implemented in TypeScript projects. Angular specifics (TestBed, zoneless, harnesses, Signal Store): [angular/testing.md](../angular/testing.md).

## Tool set (defaults TS-D6, TS-D7)

| Purpose | Tool |
|---|---|
| Test runner, assertions | Vitest |
| Test doubles for ports and contracts | `vitest-mock-extended` (`mock<T>()`) |
| Component tests | Testing Library (`@testing-library/<framework>`, `@testing-library/user-event`) |
| HTTP adapter tests | MSW with Orval-generated handlers |
| Accessibility rules in unit tests | `axe-core` |
| E2E | Playwright, `@axe-core/playwright` |

## Unit and adapter tests

- **TS-TEST-01: Test doubles are created with `mock<Contract>()` from `vitest-mock-extended`**, typed by the port or use-case interface. No hand-rolled `{ method: vi.fn() }` objects for contracts.
  *Why:* the double follows the interface automatically, and the compiler flags tests when a port changes.
- **TS-TEST-02: `vi.mock()` (module mocking) is not used for our own modules.** Dependencies come in through constructors or DI (TEST-TDD-07). `vi.mock` is acceptable only for third-party modules that can't be injected, and that is a hint to wrap them in a port.
- **TS-TEST-03: Stub queries with `calledWith(...).mockResolvedValue(...)`, verify only commands** (TEST-TDD-09).

```ts
// application/place-order.service.spec.ts — London style (TEST-ARCH-02)
import { mock } from 'vitest-mock-extended';

describe('PlaceOrderService', () => {
  const loadCart = mock<LoadCartPort>();
  const saveOrder = mock<SaveOrderPort>();
  const service = new PlaceOrderService(loadCart, saveOrder);

  it('places an order for a non-empty cart', async () => {
    loadCart.loadCart.calledWith(CustomerId.of('c-1')).mockResolvedValue(cartWith(2, 'ITEM'));

    const result = await service.placeOrder(PlaceOrderCommand.of({ customerId: 'c-1' }));

    expect(result).toEqual({ status: 'placed' });
    expect(saveOrder.saveOrder).toHaveBeenCalledOnce(); // command: verify
  });
});
```

- **TS-TEST-04: HTTP adapters are tested against MSW**, using the handlers Orval generates from the spec (`get<Operation>MockHandler`) with per-test overrides. Cover: success mapping, each documented error status, a malformed response (zod parse must fail), and batching/caching behavior where the adapter has it (API-N1-06).
- **TS-TEST-05: Domain tests are plain functions in, values out.** No DOM environment (`environment: 'node'` for domain/application projects or files).
- **TS-TEST-06: Snapshot tests are not used for component output.** Inline snapshots are acceptable for stable, small data structures (e.g. a mapped DTO), never as the only assertion of behavior.
  *Why:* large snapshots get updated without being read and become tautological (TEST-TDD-11).

## Component tests

- **TS-TEST-07: Component tests use Testing Library and query by role and accessible name** (`getByRole('button', { name: 'Place order' })`). `getByTestId` only when no accessible query exists, and then with a comment.
  *Why:* the test interacts like a user, and an element without a name can't be found, so the test also enforces accessibility (A11Y layer L2).
- **TS-TEST-08: Interactions use `@testing-library/user-event`**, not synthetic `dispatchEvent`.
- **TS-TEST-09: Every component test file runs axe on its main rendered states** (A11Y layer L3):

```ts
import axe from 'axe-core';

async function expectNoAxeViolations(container: Element) {
  const { violations } = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } }, // no layout in jsdom; checked in E2E (L4)
  });
  expect(violations).toEqual([]);
}
```

## E2E with Playwright

- **TS-TEST-10: Two tiers.**

| Tier | Runs | Backend | Purpose |
|---|---|---|---|
| `e2e` (stubbed) | Every pull request | Stubbed at the network boundary with `page.route`, using Orval-generated response factories | Main paths, states, axe scans, keyboard journeys, request budgets. Fast and deterministic. |
| `e2e:smoke` | Main branch / before release | Real backend (containers or test environment) | A handful of critical paths: proves frontend and backend really fit (TEST-ARCH-05) |

  The stub fixture is typed by `operationId`, so a contract change breaks the stub at compile time.
- **TS-TEST-11: Locators by role, label or text**, as in component tests. CSS selectors and XPath only for third-party widgets that offer nothing else.
- **TS-TEST-12: Accessibility per main screen and state** (A11Y layer L4), through a shared fixture:

```ts
// e2e/fixtures.ts
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const AAA = ['wcag2aaa', 'wcag21aaa'];
const acceptedAaaExceptions: string[] = []; // axe rule ids listed in the project's docs/accessibility.md (A11Y-02)

export const test = base.extend<{ expectAccessible: (label: string) => Promise<void> }>({
  expectAccessible: async ({ page }, use, testInfo) => {
    await use(async (label) => {
      const results = await new AxeBuilder({ page }).withTags([...AA, ...AAA]).analyze();
      await testInfo.attach(`axe-${label}`, { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
      const failing = results.violations.filter(
        (v) => v.tags.some((t) => AA.includes(t)) || !acceptedAaaExceptions.includes(v.id),
      );
      expect(failing, `axe violations in state "${label}"`).toEqual([]);
    });
  },
});
```

  AA violations always fail. AAA violations fail unless their rule is listed in the project's accessibility conformance notes (A11Y-02). All violations are attached to the report.
- **TS-TEST-13: Keyboard journeys** (A11Y layer L5): each main path also exists as a keyboard-only test (`page.keyboard.press('Tab')`, assert `toBeFocused()`, Escape closes overlays, focus returns to the trigger).
- **TS-TEST-14: Request budgets per main screen** (API-N1-06): a fixture counts API requests while the screen loads and fails when the budget is exceeded.

```ts
const apiCalls: string[] = [];
page.on('request', (r) => { if (new URL(r.url()).pathname.startsWith('/api/')) apiCalls.push(r.url()); });
await page.goto('/orders');
await expect(page.getByRole('table', { name: 'Orders' })).toBeVisible();
expect(apiCalls, 'orders screen request budget').toHaveLength(2);
```

- **TS-TEST-15: No fixed waits** (`waitForTimeout`). Use web-first assertions (`await expect(locator).toBeVisible()`).
- **TS-TEST-16: Run in Chromium, Firefox and WebKit** in CI for the stubbed tier; the smoke tier may use Chromium only.

## Skill overrides

| Skill | Says | Our rule |
|---|---|---|
| `vitest` | `vi.mock` module mocking as the standard mocking approach | Contracts mocked via DI with `vitest-mock-extended` (TS-TEST-01/02) |
| `vitest` | Snapshot testing as a general tool | Not for component output (TS-TEST-06) |
| `vitest` | `vitest.config.ts` / Vite config | Angular projects configure Vitest through the Angular CLI unit-test builder ([angular/testing.md](../angular/testing.md)) |
| `playwright-best-practices` | axe tags up to `wcag21aa` | Add `wcag22aa` and the AAA tags (TS-TEST-12) |
| `playwright-best-practices` | Never mock your own backend | Two tiers: stubbed per pull request, real backend smoke (TS-TEST-10) |
| `playwright-best-practices` | Playwright component testing | Component tests run in Vitest with Testing Library |

## Agent checklist

- [ ] Doubles via `mock<Contract>()`; no `vi.mock` of our own modules?
- [ ] Component tests query by role; axe run on main states?
- [ ] E2E: axe fixture on new screens/states, keyboard journey, request budget?
- [ ] Contract change → stubs still compile (typed by `operationId`)?

## Sources

Vitest (vitest.dev), vitest-mock-extended (github.com/eratio08/vitest-mock-extended), Testing Library guiding principles (testing-library.com), MSW (mswjs.io), Playwright (playwright.dev), `@axe-core/playwright` (github.com/dequelabs/axe-core-npm).
