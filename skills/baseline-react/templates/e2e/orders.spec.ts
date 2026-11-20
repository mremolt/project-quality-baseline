import {
  getCancelOrderResponseMock,
  getListOrdersResponseMock,
} from '../src/features/orders/adapter/out/http/generated/endpoints/orders/orders.msw';
import type { Order, OrderPage } from '../src/features/orders/adapter/out/http/generated/model';
import { expect, test } from './fixtures';

const order = (n: number, status: Order['status'] = 'OPEN'): Order =>
  getCancelOrderResponseMock({ id: `o-${String(n)}`, number: `A-${String(1000 + n)}`, status });
const pageOf = (items: Order[], number = 0, totalPages = 1): OrderPage =>
  getListOrdersResponseMock({ items, page: { number, size: 20, totalElements: items.length, totalPages } });

test.describe('orders', () => {
  test('@theme lists the orders, accessible and within its request budget', async ({
    page,
    stub,
    expectAccessible,
  }) => {
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url());
    });
    await stub('listOrders', () => pageOf([order(1), order(2, 'SHIPPED')]));

    await page.goto('/orders');

    await expect(page.getByRole('table', { name: 'Orders' })).toBeVisible();
    await expect(page).toHaveTitle('Orders | Shop');
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - banner:
        - navigation "Main"
      - main:
        - heading "Orders" [level=1]
    `);
    await expectAccessible('orders list');
    expect(apiCalls.length, 'orders screen request budget (TS-TEST-14)').toBeLessThanOrEqual(1);
  });

  test('moves focus to the heading on path changes only (TS-TEST-26)', async ({ page, stub }) => {
    await stub('listOrders', (url) => {
      const current = Number(url.searchParams.get('page') ?? '0');
      return pageOf([order(current + 1)], current, 3);
    });
    await page.goto('/');
    await expect(page).toHaveTitle('Home | Shop');

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Orders' }).click();
    await expect(page).toHaveTitle('Orders | Shop');
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeFocused();
    await expect(page.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');

    const next = page.getByRole('button', { name: 'Next page' });
    await next.click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByText('Page 2 of 3')).toBeVisible();
    await expect(next).toBeFocused();

    await page.goBack();
    await page.goBack();
    await expect(page).toHaveTitle('Home | Shop');
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeFocused();
  });

  test('cancels an order with the keyboard only (TS-TEST-13)', async ({
    page,
    stub,
    expectAnnounced,
    expectAccessible,
  }) => {
    let cancelled = false;
    await stub('listOrders', () => pageOf([order(1, cancelled ? 'CANCELLED' : 'OPEN')]));
    await stub('cancelOrder', () => {
      cancelled = true;
      return order(1, 'CANCELLED');
    });
    await page.goto('/orders');
    const trigger = page.getByRole('button', { name: 'Cancel order A-1001' });
    await expect(trigger).toBeVisible();

    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Cancel order A-1001' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expectAccessible('cancel dialog');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('textbox', { name: 'Reason' })).toBeFocused();
    await page.keyboard.type('Ordered twice');
    await page.keyboard.press('Enter');

    await expectAnnounced('Order A-1001 cancelled.');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeFocused();
    await expect(page.getByRole('cell', { name: 'Cancelled' })).toBeVisible();
  });

  test('shows a business error in the dialog', async ({ page, stub }) => {
    await stub('listOrders', () => pageOf([order(1)]));
    await stub('cancelOrder', () => ({ status: 409, code: 'ORDER_ALREADY_SHIPPED' }));
    await page.goto('/orders');

    await page.getByRole('button', { name: 'Cancel order A-1001' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Reason' }).fill('Ordered twice');
    await dialog.getByRole('button', { name: 'Cancel order' }).click();

    await expect(dialog.getByRole('alert')).toContainText('already shipped');
  });

  test('reports a server error once, with the trace id and without personal data', async ({
    page,
    stub,
    consoleErrors,
  }) => {
    await stub('listOrders', () => ({ status: 503, traceId: 'trace-42' }));
    const report = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/client-errors');

    await page.goto('/orders?page=0');

    await expect(page.getByRole('alert')).toContainText('The orders could not be loaded.');
    const body = (await report).postDataJSON() as Record<string, unknown>;
    expect(body).toMatchObject({
      type: 'TechnicalError',
      status: 503,
      traceId: 'trace-42',
      route: '/orders',
      release: '0.0.0-e2e', // from /config.json (REACT-OBS-05)
    });
    expect(JSON.stringify(body)).not.toContain('page=0');
    expect(consoleErrors.filter((message) => !message.includes('503'))).toEqual([]);
  });

  test('reloads once when a route chunk is gone after a deployment (REL-FE-04)', async ({ page, stub }) => {
    await stub('listOrders', () => pageOf([order(1)]));
    let failChunk = true;
    await page.route(
      (url) => url.pathname.startsWith('/assets/orders.composition-'),
      async (route) => {
        if (failChunk) {
          failChunk = false;
          await route.fulfill({ status: 404 });
        } else {
          await route.continue();
        }
      },
    );
    let documentLoads = 0;
    page.on('request', (request) => {
      if (request.isNavigationRequest()) documentLoads += 1;
    });

    await page.goto('/orders');

    await expect(page.getByRole('table', { name: 'Orders' })).toBeVisible();
    expect(documentLoads).toBe(2);
  });

  test('shows the static start-up message when config.json is invalid', async ({ page }) => {
    await page.route('**/config.json', (route) => route.fulfill({ json: { environment: '' } }));

    await page.goto('/orders');

    await expect(page.getByRole('alert')).toContainText('The application could not start.');
  });

  test('shows an XSS payload from the API as text (REACT-SEC-09)', async ({ page, stub }) => {
    const payload = '<img src=x onerror="window.xss=1">';
    await stub('listOrders', () => pageOf([{ ...order(1), number: payload }]));

    await page.goto('/orders');

    await expect(page.getByRole('cell', { name: payload })).toBeVisible();
    await expect(page.locator('table img')).toHaveCount(0);
    expect(await page.evaluate(() => 'xss' in window)).toBe(false);
  });

  test('sends the XSRF header on a mutating call only (REACT-SEC-06)', async ({ page, context, stub }) => {
    await context.addCookies([{ name: 'XSRF-TOKEN', value: 'token-1', url: 'http://localhost:4173' }]);
    await stub('listOrders', () => pageOf([order(1)]));
    await stub('cancelOrder', () => order(1, 'CANCELLED'));
    const list = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/v1/orders');

    await page.goto('/orders');
    expect((await list).headers()['x-xsrf-token']).toBeUndefined();

    const cancel = page.waitForRequest((request) => request.method() === 'POST');
    await page.getByRole('button', { name: 'Cancel order A-1001' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Reason' }).fill('Ordered twice');
    await dialog.getByRole('button', { name: 'Cancel order' }).click();
    expect((await cancel).headers()['x-xsrf-token']).toBe('token-1');
  });

  test('goes to the login path on 401 (REACT-SEC-06)', async ({ page, stub }) => {
    await stub('listOrders', () => ({ status: 401 }));

    await page.goto('/orders');

    await expect(page).toHaveURL(/\/login$/);
  });
});
