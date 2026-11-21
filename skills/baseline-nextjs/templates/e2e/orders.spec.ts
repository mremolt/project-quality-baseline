import { E2E_PORT } from './e2e-constants';
import { expect, test } from './fixtures';

test.describe('orders', () => {
  test.beforeEach(({ cspViolations }) => {
    expect(cspViolations).toEqual([]); // starts collecting before the first navigation
  });

  test('server-renders the orders with a nonce CSP and security headers @theme @responsive', async ({
    page,
    expectAccessible,
  }) => {
    const response = await page.goto('/orders');

    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toMatch(/script-src 'nonce-[A-Za-z0-9+/=]{24}' 'strict-dynamic'/);
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
    await expect(page).toHaveTitle('Orders | Shop');
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    const table = page.getByRole('table', { name: 'Your orders' });
    await expect(table.getByRole('row')).toHaveCount(4);
    await expect(table.getByRole('cell', { name: '€1,000,000.05' })).toBeVisible();
    await expectAccessible('orders list');
  });

  test('cancels an order through the server action and refetches through the API proxy @theme', async ({
    page,
    expectAccessible,
  }) => {
    await page.goto('/orders');
    const refetch = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/orders?page=0&size=100') && r.status() === 200,
    );

    await page.getByRole('button', { name: 'Cancel order 2026-0001' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cancel order 2026-0001' });
    await expect(dialog).toBeVisible();
    await expectAccessible('cancel dialog');
    await dialog.getByRole('textbox', { name: 'Reason' }).fill('changed my mind');
    const action = page.waitForRequest((r) => r.method() === 'POST' && r.headers()['next-action'] !== undefined);
    await dialog.getByRole('button', { name: 'Cancel order' }).click();

    await action;
    await expect(page.getByRole('status')).toHaveText('The order was cancelled.');
    await refetch;
    await expect(dialog).toBeHidden();
  });

  test('shows the business error of the backend', async ({ page }) => {
    await page.goto('/orders');

    await page.getByRole('button', { name: 'Cancel order 2026-0003' }).click();
    await page.getByRole('textbox', { name: 'Reason' }).fill('too late');
    await page.getByRole('button', { name: 'Cancel order', exact: true }).click();

    await expect(page.getByRole('alert')).toHaveText('This order has already shipped and can no longer be cancelled.');
  });

  test('keyboard journey: open, fill, submit, and escape returns focus', async ({ page }) => {
    await page.goto('/orders');
    const trigger = page.getByRole('button', { name: 'Cancel order 2026-0001' });

    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Cancel order 2026-0001' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('textbox', { name: 'Reason' })).toBeFocused();
    await page.keyboard.type('changed my mind');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cancel order' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toHaveText('The order was cancelled.');
  });

  test('rejects a replayed server action without or with a foreign Origin (NEXT-SEC-05)', async ({ page }) => {
    await page.goto('/orders');
    await page.getByRole('button', { name: 'Cancel order 2026-0001' }).click();
    await page.getByRole('textbox', { name: 'Reason' }).fill('changed my mind');
    const actionRequest = page.waitForRequest((r) => r.method() === 'POST' && r.headers()['next-action'] !== undefined);
    await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
    const original = await actionRequest;
    const headers = {
      'next-action': original.headers()['next-action'] ?? '',
      'content-type': original.headers()['content-type'] ?? 'text/plain;charset=UTF-8',
    };

    const withoutOrigin = await page.request.post('/orders', { headers, data: original.postData() ?? '' });
    const foreignOrigin = await page.request.post('/orders', {
      headers: { ...headers, origin: 'https://evil.example' },
      data: original.postData() ?? '',
    });

    const sameOrigin = await page.request.post('/orders', {
      headers: { ...headers, origin: new URL(page.url()).origin },
      data: original.postData() ?? '',
    });

    expect(withoutOrigin.status()).toBe(403);
    expect(foreignOrigin.status()).toBe(403);
    expect(sameOrigin.status()).toBe(200);
  });

  test('rejects a no-JS form post to a page (multipart, $ACTION_ID_ field, Origin null) (NEXT-SEC-05)', async ({
    page,
  }) => {
    const response = await page.request.post('/orders', {
      headers: { origin: 'null' },
      multipart: { $ACTION_ID_0000000000000000000000000000000000000000: '', reason: 'changed my mind' },
    });

    expect(response.status()).toBe(403);
    expect(response.headers()['content-type']).toBe('application/problem+json');
  });

  test('a started login leaves the live session alone until its callback (NODE-BFF-07)', async ({ page, context }) => {
    const login = await context.request.get('/auth/login?returnTo=/orders', { maxRedirects: 0 });

    expect(login.status()).toBe(302);
    expect(login.headers()['set-cookie']).toMatch(/^__Host-login=/);
    expect(login.headers()['set-cookie']).not.toContain('__Host-session');
    await page.goto('/orders');
    await expect(page.getByRole('table', { name: 'Your orders' })).toBeVisible();
  });

  test('takes same-origin error reports without a session and refuses foreign ones (NEXT-OBS-15)', async ({
    page,
    playwright,
  }) => {
    const appOrigin = `http://localhost:${String(E2E_PORT)}`;
    const report = { type: 'Error', message: 'boom', release: 'e2e', environment: 'e2e', route: '/orders' };
    const anonymous = await playwright.request.newContext({ baseURL: appOrigin });

    const sameOrigin = await anonymous.post('/client-errors', { headers: { origin: appOrigin }, data: report });
    const foreign = await page.request.post('/client-errors', {
      headers: { origin: 'https://evil.example' },
      data: report,
    });

    expect(sameOrigin.status()).toBe(204);
    expect(foreign.status()).toBe(403);
    await anonymous.dispose();
  });

  test('loads the screen within its request budget', async ({ page }) => {
    const apiCalls: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/')) apiCalls.push(r.url());
    });

    await page.goto('/orders');
    await expect(page.getByRole('table', { name: 'Your orders' })).toBeVisible();

    expect(apiCalls, 'the first page comes with the HTML').toHaveLength(0);
  });
});
