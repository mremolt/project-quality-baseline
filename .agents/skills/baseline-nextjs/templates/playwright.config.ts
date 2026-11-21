import { defineConfig } from '@playwright/test';

import { E2E_PORT } from './e2e/e2e-constants';

const size = (width: number, height: number) => ({ viewport: { width, height } });
const expanded = { browserName: 'chromium' as const, ...size(1024, 768) }; // the default cell (TS-TEST-29)
const themed = { grep: /@theme/ };

export default defineConfig({
  testDir: './e2e',
  retries: process.env['CI'] ? 1 : 0, // TS-TEST-31
  forbidOnly: Boolean(process.env['CI']),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${String(E2E_PORT)}`,
    reducedMotion: 'reduce',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  // the standalone server in test mode (APP_TEST_STUBS=1): backend calls answered by the contract stubs (D10)
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
  ],
});
