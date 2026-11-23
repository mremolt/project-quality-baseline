import { defineConfig } from '@playwright/test';

import { E2E_PORT } from './e2e/e2e-constants';

const size = (width: number, height: number) => ({ viewport: { width, height } });
const expanded = { browserName: 'chromium' as const, ...size(1024, 768) }; // the default cell (TS-TEST-29)
const themed = { grep: /@theme/ };
const responsive = { grep: /@responsive/ };
const chromium = 'chromium' as const;

export default defineConfig({
  testDir: './e2e',
  retries: process.env['CI'] ? 1 : 0, // TS-TEST-31
  workers: process.env['CI'] ? 2 : undefined, // capped in CI: load-dependent timing is not a fix (TS-TEST-31)
  forbidOnly: Boolean(process.env['CI']),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${String(E2E_PORT)}`,
    reducedMotion: 'reduce',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  // the standalone server in test mode (APP_TEST_STUBS=1): backend calls answered by the contract stubs (NEXT-D5)
  webServer: {
    command: 'node e2e/stubbed-server.ts',
    url: `http://localhost:${String(E2E_PORT)}/readyz`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
  },
  projects: [
    // T1: npm run e2e
    { name: 'stubbed-expanded', use: expanded },
    { name: 'stubbed-firefox-expanded', use: { ...expanded, browserName: 'firefox' } },
    // WebKit drops `Secure` cookies on http://localhost, so the `__Host-session` login needs an HTTPS test origin first
    { name: 'stubbed-dark', ...themed, use: { ...expanded, colorScheme: 'dark' } },
    { name: 'stubbed-high-contrast', ...themed, use: { ...expanded, contrast: 'more' } },
    // T1 rows of TS-TEST-18 added after the reference build: verify before first use (NEXT-TEST-15)
    {
      name: 'stubbed-compact',
      ...responsive,
      use: { browserName: chromium, ...size(390, 844), isMobile: true, hasTouch: true },
    },
    { name: 'stubbed-medium', ...responsive, use: { browserName: chromium, ...size(768, 1024), hasTouch: true } },
    { name: 'stubbed-reflow', ...responsive, use: { browserName: chromium, ...size(320, 800) } },
    { name: 'stubbed-forced-colors', grep: /@shell/, use: { ...expanded, forcedColors: 'active' } },
  ],
});
