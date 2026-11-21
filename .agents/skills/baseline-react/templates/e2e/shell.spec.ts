import { expect, test } from './fixtures';

/** The app shell in every theme condition (TS-TEST-28): axe and a keyboard pass with a visible focus indicator. */
test.describe('shell', () => {
  test('@shell @theme @responsive is accessible and shows keyboard focus and the current page', async ({
    page,
    expectAccessible,
  }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Home | Shop');
    await expectAccessible('shell');

    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab');
    const home = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' });
    await expect(home).toBeFocused();
    await expect(home).toHaveAttribute('aria-current', 'page');
    // A11Y-28: a focus indicator that survives forced colors is an outline, not a background or shadow
    expect(await home.evaluate((link) => getComputedStyle(link).outlineStyle)).not.toBe('none');
  });
});
