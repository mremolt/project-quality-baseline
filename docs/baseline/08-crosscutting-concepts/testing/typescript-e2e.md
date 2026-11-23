# TypeScript E2E: Matrix, Responsive, Themes, Screen Readers

The Playwright rules that go beyond the basics of [typescript.md](typescript.md) (tiers TS-TEST-10, axe fixture TS-TEST-12, keyboard journeys TS-TEST-13, request budgets TS-TEST-14): which browsers, viewports and themes run when, responsive checks, screen reader assertions, flaky tests and the time budget. They implement [10-quality-requirements/accessibility.md](../../10-quality-requirements/accessibility.md); "main screen" and "main state" mean the entries of the product's journey and screen inventory (A11Y-27).

## Matrix

- **TS-TEST-17: Viewports are Playwright projects named after the size class**, defined once in `playwright.config.ts`. Tests don't call `setViewportSize`, except in resize-transition tests (TS-TEST-20). Device presets (`devices[...]`) only when the device's browser engine is wanted; otherwise `viewport` + `isMobile` + `hasTouch`, which keeps the engine under our control.
  *Why:* one source of truth, the same specs at every size, sizes that match the window size classes (UI-01).

| Viewport | Size (w × h) | Emulation | Purpose |
|---|---|---|---|
| `compact` | 390 × 844 | `isMobile`, `hasTouch` | Phone; bottom bar or modal drawer |
| `compact-landscape` | 844 × 390 | `isMobile`, `hasTouch` | Orientation (A11Y-15); by width this is already `expanded` |
| `reflow` | 320 × 800 | none | Reflow (A11Y-13), stands in for 400 % zoom |
| `medium` | 768 × 1024 | `hasTouch` | Tablet portrait; rail |
| `expanded` | 1024 × 768 | none | Tablet landscape, small laptop; default for all specs |
| `large` | 1440 × 900 | none | Desktop |
| `extra-large` | 1920 × 1080 | none | Max width and panes only |

- **TS-TEST-18: The matrix is tiered, and this table is its only definition.** Specs for main screens and states are tagged `@responsive` and run in the viewport projects; specs that scan main states are also tagged `@theme`; the app shell spec is tagged `@shell`.

| Tier | Script | When | Projects |
|---|---|---|---|
| T1 | `e2e` | Every pull request | Default cell (all specs); Chromium at `compact`, `medium`, `reflow` (`@responsive`); Firefox and WebKit at `expanded`; Chromium dark and high contrast (`@theme`), forced colors (`@shell`) (TS-TEST-28) |
| T2 | `e2e:nightly` | Main branch, nightly | T1 plus Chromium at `large`, `extra-large`, `compact-landscape`; Firefox and WebKit at `compact`; visual regression if the project uses it (TS-TEST-22) |
| T3 | manual | Before release | The L6 release checklist of [accessibility.md](../../10-quality-requirements/accessibility.md#l6-release-checklist) (A11Y-18, A11Y-24) |

  *Why:* the full matrix of browsers × viewports costs about four times as much and catches few extra bugs on pull requests.

- **TS-TEST-28: Tagged main states are re-scanned in the other theme conditions, in one browser and one viewport:** Chromium at `expanded` with `colorScheme: 'dark'` and with `contrast: 'more'`, running the `@theme` specs and their axe fixture (TS-TEST-12); and with `forcedColors: 'active'` on the app shell (`@shell`): axe plus a keyboard pass asserting a visible focus indicator and the current navigation item (A11Y-28).
  *Why:* contrast is only verified in a real browser; without theme projects, dark and high-contrast themes (A11Y-09) are never scanned.

- **TS-TEST-29: The matrix grows one dimension at a time from the default cell.** The default cell is Chromium, `expanded`, light theme, no contrast preference, source locale; every spec runs there. Each further project changes exactly one dimension: browser, viewport, theme (TS-TEST-28) or locale (TEST-I18N-02). Cross products (WebKit × dark × compact) are not added; a product that needs one specific combination adds that one cell with a reason in the config.
  *Why:* each dimension added independently multiplies the run time; the bugs a dimension finds show up with the others at their default.

```ts
// playwright.config.ts (excerpt)
import { defineConfig } from '@playwright/test';

const touch = { isMobile: true, hasTouch: true }; // isMobile isn't supported in Firefox: leave it out there
const size = (width: number, height: number) => ({ viewport: { width, height } });
const expanded = { browserName: 'chromium' as const, ...size(1024, 768) }; // the default cell (TS-TEST-29)
const responsive = { grep: /@responsive/ };
const themed = { grep: /@theme/ };

export default defineConfig({
  retries: process.env['CI'] ? 1 : 0, // TS-TEST-31 (bracket access: noPropertyAccessFromIndexSignature, TS-TOOL-01)
  use: { baseURL: 'http://localhost:4200', reducedMotion: 'reduce' },
  projects: [
    // T1: npm run e2e  (playwright test --project=stubbed-*)
    { name: 'stubbed-expanded', use: expanded },
    { name: 'stubbed-firefox-expanded', use: { ...expanded, browserName: 'firefox' } },
    { name: 'stubbed-webkit-expanded', use: { ...expanded, browserName: 'webkit' } },
    { name: 'stubbed-compact', ...responsive, use: { browserName: 'chromium', ...size(390, 844), ...touch } },
    { name: 'stubbed-medium', ...responsive, use: { browserName: 'chromium', ...size(768, 1024), hasTouch: true } },
    { name: 'stubbed-reflow', ...responsive, use: { browserName: 'chromium', ...size(320, 800) } },
    { name: 'stubbed-dark', ...themed, use: { ...expanded, colorScheme: 'dark' } },
    { name: 'stubbed-high-contrast', ...themed, use: { ...expanded, contrast: 'more' } },
    { name: 'stubbed-forced-colors', grep: /@shell/, use: { ...expanded, forcedColors: 'active' } },
    // T2: npm run e2e:nightly  (playwright test --project=stubbed-* --project=nightly-*)
    { name: 'nightly-large', ...responsive, use: { browserName: 'chromium', ...size(1440, 900) } },
    { name: 'nightly-extra-large', ...responsive, use: { browserName: 'chromium', ...size(1920, 1080) } },
    { name: 'nightly-compact-landscape', ...responsive, use: { browserName: 'chromium', ...size(844, 390), ...touch } },
    { name: 'nightly-webkit-compact', ...responsive, use: { browserName: 'webkit', ...size(390, 844), ...touch } },
    { name: 'nightly-firefox-compact', ...responsive, use: { browserName: 'firefox', ...size(390, 844), hasTouch: true } },
    // full-stack system test project (TS-TEST-10) unchanged
  ],
});
```

### Time budget and flaky tests

- **TS-TEST-30: The pull-request tier has a wall-clock budget**, recorded in the product's chapter 10 and enforced as the time limit of the pipeline job (default: 15 minutes). When the tier exceeds it, the team shards the run or moves projects to the nightly tier; main-screen axe scans and keyboard journeys at the default cell stay on pull requests.
  *Why:* a slow gate gets bypassed; a number makes growth visible before it hurts.
- **TS-TEST-31: Retries only in CI, and a retried test is a defect.** `retries` is 0 locally and at most 1 in CI and nightly runs. A test that passes only on retry (Playwright reports it as flaky) gets a ticket and is fixed within a week; one that is still flaky then is quarantined with `test.fixme` and the ticket reference, never deleted and never given more retries or a longer timeout (A11Y-04). CI caps `workers` (e.g. `workers: process.env.CI ? 2 : undefined`) so load-dependent timing does not create flakes; "passes when run alone" is a finding, not a fix.
  *Why:* retries hide real races; a deadline keeps them from becoming permanent.
- **TS-TEST-32: A stubbed E2E test fails when the page makes an API call that no stub answers, throws an unhandled error, or reports a missing translation.** The shared fixture (`e2e/fixtures.ts`) registers a catch-all route for the API prefix before the test's own stubs (Playwright runs the most recently registered matching route first), which answers 501 and records the call. It also collects `pageerror` events, `console.error` messages and the i18n library's missing-key warnings. Teardown fails the test when any were recorded, unless the test declares them as expected (`expectErrors(/…/)`).
- **TS-TEST-33: Run E2E at milestones while building, the full matrix once per delivered part.** While developing, unit, component and adapter tests only. At a milestone (a screen or route works for the first time, or bootstrap, routing, i18n, theme or the HTTP stack changed) run `e2e:fast`, the one-cell run of a few seconds. Run `e2e:smoke` (the real-backend tier) also at the first call of a new real dependency (IdP, mail server, external API) and after any change to the security filter chain, the session or the code that serves the SPA (nonce templating, headers, static files). Before the commit that closes a part (a feature, a step of the plan) run the matrix of TS-TEST-18 and, for a stack with a backend, `e2e:smoke`. Neither none-until-the-end nor the matrix after every change. The `e2e:smoke` script rebuilds the image it runs against (or checks that the image's revision label equals `git rev-parse HEAD`), so a new scenario never runs against a stale bundle and reports a missing element that looks like a product bug.
  *Why:* in the first test drive the E2E run found five bugs that 40 unit and component tests missed (injection context, scope-prefixed keys, stale document title, nameless button on compact, forced-colours palette): they need the real router, DI, browser or CSS, and each costs little to find early and much to find late. In the following steps only the real-backend run found the expensive defects: an eval-based ICU library blocked by the CSP, duplicate nonce attributes, security headers missing on `index.html`, fonts answered with 404, `null` sent where the contract omits the field, and an IdP admin API refusing its token; the stubbed tier and all unit and integration tests were green.
  ```ts
  // e2e/fixtures.ts (excerpt)
  page: async ({ page }, use) => {
    const problems: string[] = [];
    await page.route('**/api/**', (route) => {
      problems.push(`unstubbed ${route.request().method()} ${route.request().url()}`);
      return route.fulfill({ status: 501 });
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console: ${msg.text()}`); });
    await use(page);
    expect(problems, 'unexpected API calls or runtime errors').toEqual([]);
  },
  ```
  *Why:* without this, a page can render half-broken (a request that fell through to the dev server, an unhandled rejection) while every assertion passes.

## Responsive

- **TS-TEST-19: A shared fixture asserts reflow and text spacing** on every `@responsive` screen: no horizontal overflow of the document (A11Y-13), and no clipped text after the WCAG 1.4.12 spacing is injected (A11Y-14). Elements that are visually hidden on purpose (1 × 1 px) are skipped.

```ts
// e2e/fixtures.ts (continued)
const TEXT_SPACING = `
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
  p { margin-block-end: 2em !important; }`;

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page scrolls horizontally (WCAG 1.4.10)').toBeLessThanOrEqual(0);
}

export async function expectTextSpacingTolerant(page: Page) {
  await page.addStyleTag({ content: TEXT_SPACING });
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => el.clientWidth > 1 && el.clientHeight > 1 && el.textContent?.trim())
      .filter((el) => /hidden|clip/.test(getComputedStyle(el).overflow))
      .filter((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.outerHTML.slice(0, 120)),
  );
  expect(clipped, 'text clipped with WCAG 1.4.12 spacing').toEqual([]);
}
```

- **TS-TEST-20: Each shell and each list-detail screen has a resize-transition test**: resize from `expanded` to `compact` and back with `page.setViewportSize`, and assert that the URL, the selected item and typed form values survive and that focus isn't lost.
  *Why:* UI-05; users rotate devices and resize windows mid-task.
- **TS-TEST-21: Target size (A11Y-10, A11Y-16) is asserted in the browser, and the axe fixture proves that `target-size` ran.** The rule belongs to the WCAG 2.2 rules, which axe treats separately; after `analyze()`, assert that `target-size` appears in `passes`, `violations` or `incomplete`, and if it doesn't, enable it explicitly. The jsdom helper (TS-TEST-09) disables `target-size`, because without layout it reports a false pass. A bounding-box check (`locator.boundingBox()`) on the screen's main controls at `compact` fails below 24 × 24 px, and below 44 × 44 px unless the control is listed in the conformance notes (A11Y-02).
- **TS-TEST-22: Visual regression is opt-in per project.** A project that adopts it uses Playwright `toHaveScreenshot` for the shell and `shared/ui` components only, at `compact`, `medium` and `expanded`, in one theme. Screenshots are taken in the pinned Playwright Docker image, baselines are updated only by CI, animations are disabled and volatile content is masked. Hosted services (Argos, Chromatic, Percy) need an ADR.
  *Why:* rendering differs between operating systems, so local baselines don't match CI; large screenshot sets are approved without being looked at (same reason as TS-TEST-06).

## Screen readers

- **TS-TEST-23: Assert accessible name, description and state through accessibility APIs, not ARIA attributes:** `getByRole(role, { name, description, expanded, selected, checked, pressed, level })`, jest-dom and Playwright `toHaveAccessibleName` / `toHaveAccessibleDescription`. `toHaveAttribute('aria-…')` only when the attribute itself is the contract.
  *Why:* tests what assistive technology computes, and survives a refactoring from ARIA to native semantics.
- **TS-TEST-24: Status messages are asserted after the triggering action** (A11Y-20): visible ones by `getByRole('status' | 'alert')`; announcer-only messages through a shared `expectAnnounced(text)` E2E fixture that reads the live regions. This is the one allowed CSS-attribute locator (`[aria-live]`), because the announcer region has no role (exception to TS-TEST-11). Web-first assertions only (TS-TEST-15).
- **TS-TEST-25: The app shell and each main screen have a scoped, partial ARIA snapshot** (A11Y-23): `toMatchAriaSnapshot` on the landmarks (shell) and on the heading outline of `main` (screen), regex for volatile data, default `contain` matching, inline or in `.aria.yml` files, updated only with `--update-snapshots` in a reviewed change. Full-page or deep-equal snapshots are not used.
  *Why:* a small structural contract stays readable and reviewable; this is why TS-TEST-06 has an exception.
- **TS-TEST-26: Each main route has an E2E navigation test** (A11Y-21), at the default cell:
  - after a link click: `toHaveTitle` with the new title, and the routed `h1` is focused;
  - after `goBack()`: the previous page's title, its `h1` is focused, and `window.scrollY` equals the value recorded before leaving;
  - after a navigation that changes only query parameters (a filter or paging control): the control that triggered it is still focused.
- **TS-TEST-27 (opt-in per project): Real screen reader smoke tests run nightly with NVDA on Windows for one to three critical journeys.** They live in `e2e/screen-reader/`, use `@guidepup/playwright` with its own config (`withGuidepup`, which forces serial, headed runs), run nightly against the stubbed app (TS-TEST-10) on a Windows runner with NVDA + Chrome, cover one to three critical journeys, and assert that the phrase log *contains* the key phrases (title, heading, status message, error), never equality with the whole log. Guidepup and setup versions are pinned. Cost and stability are measured on the first product before the next one adopts it (A11Y-25).
  *Why:* catches announcement regressions the DOM checks can't see, without slowing pull requests. Guidepup cannot drive JAWS, TalkBack or iOS VoiceOver, so it never replaces A11Y-24.

```ts
// E2E: title and focus on navigation, back and query-only changes (TS-TEST-26)
await page.goto('/orders');
await page.mouse.wheel(0, 600);
const scrollBefore = await page.evaluate(() => window.scrollY);
await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Customers' }).click();
await expect(page).toHaveTitle('Customers | Shop');
await expect(page.getByRole('heading', { level: 1, name: 'Customers' })).toBeFocused();

await page.goBack();
await expect(page).toHaveTitle('Orders | Shop');
await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeFocused();
await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore);

const status = page.getByRole('combobox', { name: 'Status' });
await status.click();
await page.getByRole('option', { name: 'Shipped' }).click();
await expect(page).toHaveURL(/status=shipped/);
await expect(status).toBeFocused();

// E2E: shell landmark contract (TS-TEST-25, A11Y-23)
await expect(page.locator('body')).toMatchAriaSnapshot(`
  - banner
  - navigation "Main"
  - main
`);

// E2E: scoped screen structure (TS-TEST-25)
await expect(page.getByRole('main')).toMatchAriaSnapshot(`
  - heading "Orders" [level=1]
  - table "Orders":
    - rowgroup:
      - row /Order o-\\d+/
`);
```

A shell with a footer adds `- contentinfo` to its landmark snapshot.

## Skill overrides

| Skill | Says | Our rule |
|---|---|---|
| `playwright-best-practices` (accessibility) | Live region found with `[aria-live="polite"]`; `toHaveAttribute('aria-expanded', …)` and similar checks; test with VoiceOver or NVDA "periodically" | `getByRole('status')` or the `expectAnnounced` fixture (TS-TEST-24); role options and `toHaveAccessible*` (TS-TEST-23); L6 release checklist per release (A11Y-24) |
| `playwright-best-practices` (mobile-testing) | Breakpoints 375 / 768 / 1920 or Tailwind-style `xs`…`2xl`; loops over `setViewportSize`; `getByTestId('mobile-menu-button')` | Viewport projects named after the Material Design 3 size classes (UI-01, TS-TEST-17); `setViewportSize` only for resize transitions (TS-TEST-20); locators by role and name (TS-TEST-11) |
| `playwright-best-practices` (visual-regression) | `waitForLoadState('networkidle')` before screenshots; screenshots as a default | Web-first assertions (TS-TEST-15); visual regression is opt-in (TS-TEST-22) |
| `playwright-best-practices` (flaky tests) | Raise retries or timeouts to stabilise a test | Retries 0 locally, at most 1 in CI; a flaky test gets a ticket and a fix date (TS-TEST-31) |

*Agent checklist in [checklists/typescript.md](../../checklists/typescript.md) and sources in [sources.md](../../sources.md), section "TypeScript E2E: Matrix, Responsive, Themes, Screen Readers".*
