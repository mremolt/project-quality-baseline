import { expect, test } from '@playwright/test';

/**
 * Full-stack system test (TS-TEST-10), run by `npm run e2e:smoke` against a real BFF and backend at SMOKE_BASE_URL:
 * the BFF serves the bundle and the real `/config.json`. Product smoke specs add a handful of critical paths with a
 * test user (TEST-ARCH-05). Verify before first use: not run in the validation project.
 */
test.beforeAll(() => {
  if (!process.env['SMOKE_BASE_URL']) throw new Error('e2e:smoke needs SMOKE_BASE_URL, the URL of the running BFF');
});

test('the app starts with the configuration of the environment', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('#startup-error')).toBeHidden();
});
