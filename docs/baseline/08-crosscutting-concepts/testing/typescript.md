# TypeScript Testing

How the shared testing rules ([08-crosscutting-concepts/testing/testing-by-architecture-element.md](testing-by-architecture-element.md), [08-crosscutting-concepts/testing/tdd.md](tdd.md), [10-quality-requirements/accessibility.md](../../10-quality-requirements/accessibility.md)) are implemented in TypeScript projects. Responsive, theme and screen reader E2E checks and the browser × viewport matrix: [typescript-e2e.md](typescript-e2e.md).

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
- **TS-TEST-03: Stub queries with `calledWith(...).mockResolvedValue(...)`, verify only commands** (TEST-TDD-09). `calledWith` compares an argument that is not a matcher with `===` (vitest-mock-extended 6), so a value object or command built in the test never matches the one the code under test builds; pass a typed `matches((arg: T) => …)` predicate for those (`expect.objectContaining` also works, but is typed `any` and fails `no-unsafe-argument`).

```ts
// application/place-order.service.spec.ts — London style (TEST-ARCH-02)
import { matches, mock } from 'vitest-mock-extended';

describe('PlaceOrderService', () => {
  const loadCart = mock<LoadCartPort>();
  const saveOrder = mock<SaveOrderPort>();
  const service = new PlaceOrderService(loadCart, saveOrder);

  it('places an order for a non-empty cart', async () => {
    loadCart.loadCart
      .calledWith(matches((id: CustomerId) => id.value === 'c-1')) // value object: not the same instance (===)
      .mockResolvedValue(cartWith(2, 'ITEM'));

    const result = await service.placeOrder(PlaceOrderCommand.of({ customerId: 'c-1' }));

    expect(result).toEqual({ status: 'placed' });
    expect(saveOrder.saveOrder).toHaveBeenCalledOnce(); // command: verify
  });
});
```

- **TS-TEST-04: HTTP adapters are tested against MSW**, using the handlers Orval generates from the spec (`get<Operation>MockHandler`) with per-test overrides. Cover: success mapping, each documented error status, a malformed response (zod parse must fail), and batching/caching behavior where the adapter has it (API-N1-06). This holds in Angular too: `HttpTestingController` is not used for adapter tests. Its one allowed use is an Angular HTTP interceptor's test (NG-OBS-04, NG-SEC-13), which tests the `HttpClient` pipeline, not the contract.
  *Why:* the generated handlers derive the fixtures from the spec, so a contract change breaks the adapter test instead of passing it with a hand-written body; and MSW is the same mechanism in every TypeScript stack and in the stubbed E2E tier.
- **TS-TEST-05: Domain tests are plain functions in, values out.** No DOM environment (`environment: 'node'` for domain/application projects or files).
- **TS-TEST-06: Snapshot tests are not used for component output.** Inline snapshots are acceptable for stable, small data structures (e.g. a mapped DTO), never as the only assertion of behavior. Scoped ARIA snapshots are the one exception (TS-TEST-25).
  *Why:* large snapshots get updated without being read and become tautological (TEST-TDD-11).

## Component tests

- **TS-TEST-07: Component tests use Testing Library and query by role and accessible name** (`getByRole('button', { name: 'Place order' })`). `getByTestId` only when no accessible query exists, and then with a comment.
  *Why:* the test interacts like a user, and an element without a name can't be found, so the test also enforces accessibility (A11Y layer L2).
- **TS-TEST-08: Interactions use `@testing-library/user-event`**, not synthetic `dispatchEvent`. The one exception is a native `type="date"`, `"time"` or `"month"` input that user-event cannot type into under jsdom: there `fireEvent.input`/`fireEvent.change` sets the value, with a comment naming this exception (component libraries' pickers are driven through their harness or user-event).
- **TS-TEST-09: Every component test file runs axe on its main rendered states** (A11Y layer L3):

```ts
import axe from 'axe-core';

async function expectNoAxeViolations(container: Element) {
  const { violations } = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false }, // no layout in jsdom; checked in E2E (L4)
      'target-size': { enabled: false }, // same; a jsdom run would report a false pass (TS-TEST-21)
    },
  });
  expect(violations).toEqual([]);
}
```

  A small CI check SHOULD enforce this rule: every component spec file calls the axe helper.

## E2E with Playwright

- **TS-TEST-10: Two tiers.**

| Tier | Script | Runs | Backend | Purpose |
|---|---|---|---|---|
| Frontend system test | `e2e` | Every pull request | Stubbed from the OpenAPI contract at the network boundary with `page.route`, using Orval-generated response factories | Main paths, states, axe scans, keyboard journeys, request budgets. Fast and deterministic. |
| Full-stack system test | `e2e:smoke` | Main branch / before release | Real backend (containers or test environment); only third parties stubbed | A handful of critical paths: proves frontend and backend really fit (TEST-ARCH-05) |

  The stub fixture is typed by `operationId`, so a contract change breaks the stub at compile time.
- **TS-TEST-11: Locators by role, label or text**, as in component tests. CSS selectors and XPath only for third-party widgets that offer nothing else.
- **TS-TEST-12: Accessibility per main screen and state** (A11Y layer L4, A11Y-27), through a shared fixture. The tag list is the one of A11Y-05:

```ts
// e2e/fixtures.ts
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const AAA = ['wcag2aaa']; // axe has no wcag21aaa / wcag22aaa tag
const LEGAL: string[] = []; // ['EN-301-549'] where A11Y-26 applies; its violations fail like AA
const ADOPTED_AAA_RULES = ['color-contrast-enhanced']; // axe rules for the adopted AAA set (A11Y-02); 2.5.5 is checked by bounding box (TS-TEST-21)
const acceptedAaaExceptions: string[] = []; // adopted-AAA rule ids listed in the project's docs/accessibility.md (A11Y-02)

export const test = base.extend<{ expectAccessible: (label: string) => Promise<void> }>({
  expectAccessible: async ({ page }, use, testInfo) => {
    await use(async (label) => {
      // Scan only a settled page: a fading focus layer or an opening dialog reports false contrast findings
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
      const results = await new AxeBuilder({ page }).withTags([...AA, ...AAA, ...LEGAL]).analyze();
      await testInfo.attach(`axe-${label}`, { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
      const failing = results.violations.filter(
        (v) =>
          v.tags.some((t) => AA.includes(t) || LEGAL.includes(t)) ||
          (ADOPTED_AAA_RULES.includes(v.id) && !acceptedAaaExceptions.includes(v.id)),
      );
      expect(failing, `axe violations in state "${label}"`).toEqual([]);
    });
  },
});
```

  AA violations always fail. Violations of the adopted AAA rules fail unless the rule is listed in the project's accessibility conformance notes (A11Y-02). Other AAA findings (criteria the baseline does not adopt) are reported without failing. All violations are attached to the report. The fixture waits until no animation runs before it scans (transitions, Material state layers, dialogs opening), so a measurement mid-animation cannot fail or pass a state by chance.
- **TS-TEST-13: Keyboard journeys** (A11Y layer L5): each main path also exists as a keyboard-only test (`page.keyboard.press('Tab')`, assert `toBeFocused()`, Escape closes overlays, focus returns to the trigger).
- **TS-TEST-14: Request budgets per main screen** (API-N1-06): a fixture counts API requests while the screen loads and fails when the budget is exceeded. The assertion is an upper bound, so a screen that gets cheaper still passes. The counter sees every request, including those the catch-all route of TS-TEST-32 answers, never only the ones a stub records. The budget is polled (`expect.poll`) until the screen's last request has arrived, because a request that follows the first paint makes a one-shot assertion racy. Reads the shell makes on every screen (a menu badge, the current user) are listed in the budget of every screen of the roles that trigger them, with the moment they refresh named in the shell's code.

```ts
const apiCalls: string[] = [];
page.on('request', (r) => { if (new URL(r.url()).pathname.startsWith('/api/')) apiCalls.push(new URL(r.url()).pathname); });
await page.goto('/orders');
await expect(page.getByRole('table', { name: 'Orders' })).toBeVisible();
await expect.poll(() => apiCalls, { message: 'orders screen requests' }).toEqual(['/api/v1/me', '/api/v1/orders']);
expect(apiCalls.length, 'orders screen request budget').toBeLessThanOrEqual(2);
```

- **TS-TEST-15: No fixed waits** (`waitForTimeout`). Use web-first assertions (`await expect(locator).toBeVisible()`). A test branches only on an auto-waiting assertion or on `locator.or()` (wait for one of the expected states), never on `isVisible()`, which answers at once and silently skips half a scenario. After an action that re-renders a list (filter, search, sort), wait for the list's settled state (its exact row count or the expected first row) before acting on a row; a menu opened on a row that re-renders detaches.
- **TS-TEST-34: Every E2E scenario arranges its own data and leaves nothing another run depends on.** Data a scenario creates gets a unique, exact name or id (a run suffix), and lookups use that exact name or the id, never a prefix such as "Dev User" that matches what other scenarios created in the shared database. A scenario that changes shared state (deactivates a person, locks a month) restores it in `finally`/teardown, so a failure halfway does not make the next run fail for a different reason. Tests never assume an empty table or a fresh stack.
- **TS-TEST-35: An E2E test never waits out a business rule; it arranges the state through the API.** When a rule needs time to pass (a minimum duration, an expired deadline, a past period), the test creates the data with past timestamps through the API (or the stub returns it) and then exercises the screen. A real wait is the last resort, with its own `test.setTimeout` and a comment naming the rule, and is reported as debt.
- **TS-TEST-16: The stubbed tier runs in Chromium, Firefox and WebKit; the smoke tier may use Chromium only.** WebKit stands in for Safari, which on iOS and iPadOS also underlies every other browser; it differs from Chromium in ways these tests assert (keyboard focus on click and Tab order, cookie handling for the BFF session, form controls, CSS support). Playwright's WebKit is not Safari itself; the manual release check with real browsers and screen readers (A11Y-24, L6 release checklist) stays the backstop. Which browser runs at which viewport, theme and tier is defined once, by the matrix in TS-TEST-18.

Rules TS-TEST-17..27 and the matrix rules from TS-TEST-28 on are in [typescript-e2e.md](typescript-e2e.md): viewports and the tiered matrix, themes, reflow and text spacing, resize transitions, target size, visual regression, screen reader assertions, flaky tests and the time budget.

## Skill overrides

| Skill | Says | Our rule |
|---|---|---|
| `vitest` | `vi.mock` module mocking as the standard; snapshot testing as a general tool; a free-standing `vitest.config.ts` | Contracts mocked via DI with `vitest-mock-extended` (TS-TEST-01/02); no snapshots of component output (TS-TEST-06); a stack may configure Vitest through its CLI |
| `playwright-best-practices` | Never mock your own backend | Frontend system test with the backend stubbed from the contract on every pull request, full-stack system test as smoke (TS-TEST-10) |
| `playwright-best-practices` | axe tags up to `wcag21aa` | The tag list of A11Y-05; only AA and the adopted AAA rules fail (TS-TEST-12) |
| `playwright-best-practices` | Playwright component testing | Component tests run in Vitest with Testing Library |
| `playwright-best-practices` (accessibility, mobile-testing, visual-regression) | ARIA attribute locators and checks, `getByTestId`, breakpoints 375 / 768 / 1920, `setViewportSize` loops, `networkidle` waits, screenshots as a default, screen readers "periodically" | Locators by role and name (TS-TEST-11); web-first assertions (TS-TEST-15); everything else as overridden in [typescript-e2e.md](typescript-e2e.md#skill-overrides) |

*Agent checklist in [checklists/typescript.md](../../checklists/typescript.md) and sources in [sources.md](../../sources.md), section "TypeScript Testing".*
