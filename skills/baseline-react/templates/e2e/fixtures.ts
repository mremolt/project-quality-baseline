import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, type Route, test as base } from '@playwright/test';

import type { Order, OrderPage } from '../src/features/orders/adapter/out/http/generated/model';

const AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const AAA = ['wcag2aaa'];
const ADOPTED_AAA_RULES = ['color-contrast-enhanced']; // no accepted exceptions in this app (A11Y-02)

export const runtimeConfig = {
  environment: 'e2e',
  release: '0.0.0-e2e',
  requestTimeoutMs: 5_000,
  loginPath: '/login',
  errorReporting: { enabled: true, path: '/api/client-errors' },
};

/** Responses per operationId of the spec: a contract change breaks the stubs at compile time (TS-TEST-10). */
interface Operations {
  listOrders: OrderPage;
  cancelOrder: Order;
}
interface Problem {
  readonly status: number;
  readonly code?: string;
  readonly traceId?: string;
}
type Responder<T> = (request: URL) => T | Problem;
const PATHS: Readonly<Record<keyof Operations, (url: URL) => boolean>> = {
  listOrders: (url) => url.pathname === '/api/v1/orders',
  cancelOrder: (url) => /^\/api\/v1\/orders\/[^/]+\/cancel$/.test(url.pathname),
};

function isProblem(body: object): body is Problem {
  return 'status' in body && typeof body.status === 'number';
}

async function fulfil(route: Route, body: object): Promise<void> {
  if (isProblem(body)) {
    await route.fulfill({
      status: body.status,
      contentType: 'application/problem+json',
      json: { type: 'about:blank', title: 'Problem', ...body },
    });
  } else {
    await route.fulfill({ json: body });
  }
}

declare global {
  interface Window {
    cspViolations?: string[];
  }
}

interface Fixtures {
  stub: <K extends keyof Operations>(operationId: K, respond: Responder<Operations[K]>) => Promise<void>;
  expectAccessible: (label: string) => Promise<void>;
  expectAnnounced: (text: string) => Promise<void>;
  consoleErrors: string[];
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        window.cspViolations ??= [];
        window.cspViolations.push(
          `${event.effectiveDirective} ${event.blockedURI} ${event.sourceFile}:${String(event.lineNumber)}:${String(event.columnNumber)} ${event.sample}`,
        );
      });
    });
    await page.route('**/config.json', (route) => route.fulfill({ json: runtimeConfig }));
    await page.route('**/api/client-errors', (route) => route.fulfill({ status: 204 }));
    await use(page);
    // Every test: no CSP or Trusted Types violation, in any page state (REACT-SEC-09)
    const violations = await page.evaluate(() => window.cspViolations ?? []);
    expect(violations, 'CSP / Trusted Types violations').toEqual([]);
  },
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
  },
  stub: async ({ page }, use) => {
    await use(async (operationId, respond) => {
      await page.route(PATHS[operationId], (route) => fulfil(route, respond(new URL(route.request().url()))));
    });
  },
  expectAccessible: async ({ page }, use, testInfo) => {
    await use(async (label) => {
      const results = await new AxeBuilder({ page }).withTags([...AA, ...AAA]).analyze();
      await testInfo.attach(`axe-${label}`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: 'application/json',
      });
      const failing = results.violations.filter(
        (v) => v.tags.some((t) => AA.includes(t)) || ADOPTED_AAA_RULES.includes(v.id),
      );
      expect(failing, `axe violations in state "${label}"`).toEqual([]);
      const ran = [...results.passes, ...results.violations, ...results.incomplete, ...results.inapplicable];
      expect(
        ran.map((r) => r.id),
        'target-size ran (TS-TEST-21)',
      ).toContain('target-size');
    });
  },
  expectAnnounced: async ({ page }, use) => {
    await use(async (text) => {
      // TS-TEST-24: the announcer region has no role; the one allowed attribute locator
      await expect(page.locator('[aria-live]').filter({ hasText: text })).toHaveCount(1);
    });
  },
});

export { expect, type Page };
