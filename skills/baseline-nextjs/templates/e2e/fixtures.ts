import { AxeBuilder } from '@axe-core/playwright';
import { expect, test as base } from '@playwright/test';

import { E2E_IDP_ORIGIN } from './e2e-constants';

const AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const AAA = ['wcag2aaa']; // axe has no wcag21aaa / wcag22aaa tag
const ADOPTED_AAA_RULES = ['color-contrast-enhanced']; // A11Y-02

const acceptedAaaExceptions: string[] = [];

interface Fixtures {
  expectAccessible: (label: string) => Promise<void>;
  /** CSP and Trusted Types violations reported by the page; asserted empty after every test. */
  cspViolations: string[];
}

export const test = base.extend<Fixtures>({
  /**
   * Logs in through the BFF before each test: /auth/login answers with the IdP's authorization URL, which the
   * stubbed IdP would answer with `code=<nonce>` (see idp-stub-handlers); the callback then sets the session cookie.
   * `context.request` shares the browser context's cookies.
   */
  context: async ({ context }, use) => {
    const login = await context.request.get('/auth/login?returnTo=/orders', { maxRedirects: 0 });
    const authorize = new URL(login.headers()['location'] ?? '');
    expect(authorize.origin).toBe(E2E_IDP_ORIGIN);
    const callback = new URL(authorize.searchParams.get('redirect_uri') ?? '');
    callback.searchParams.set('code', authorize.searchParams.get('nonce') ?? '');
    callback.searchParams.set('state', authorize.searchParams.get('state') ?? '');
    const done = await context.request.get(callback.href, { maxRedirects: 0 });
    expect(done.status(), 'login callback').toBe(302);
    await use(context);
  },
  cspViolations: async ({ page }, use) => {
    const violations: string[] = [];
    await page.exposeFunction('reportCspViolation', (text: string) => violations.push(text));
    await page.addInitScript(() => {
      const report = (window as unknown as { reportCspViolation: (text: string) => void }).reportCspViolation;
      document.addEventListener('securitypolicyviolation', (event) => {
        report(
          `${event.effectiveDirective} ${event.blockedURI} ${event.sample} at ${event.sourceFile}:${String(event.lineNumber)}:${String(event.columnNumber)}`,
        );
      });
    });
    page.on('console', (message) => {
      if (/Content Security Policy|Trusted Type|TrustedHTML|TrustedScript/i.test(message.text())) {
        violations.push(message.text());
      }
    });
    await use(violations);
    expect(violations, 'CSP or Trusted Types violations').toEqual([]);
  },
  expectAccessible: async ({ page }, use, testInfo) => {
    await use(async (label) => {
      // Scan a settled page only: a fading state layer or an opening dialog reports false findings (TS-TEST-12)
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
      const results = await new AxeBuilder({ page }).withTags([...AA, ...AAA]).analyze();
      await testInfo.attach(`axe-${label}`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: 'application/json',
      });
      const failing = results.violations.filter(
        (v) =>
          v.tags.some((t) => AA.includes(t)) ||
          // eslint-disable-next-line sonarjs/no-empty-collection -- filled per project (A11Y-02)
          (ADOPTED_AAA_RULES.includes(v.id) && !acceptedAaaExceptions.includes(v.id)),
      );
      expect(failing, `axe violations in state "${label}"`).toEqual([]);
    });
  },
});

export { expect };
