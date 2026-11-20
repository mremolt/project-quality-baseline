import { defineConfig } from '@playwright/test';

const size = (width: number, height: number) => ({ viewport: { width, height } });
const expanded = { browserName: 'chromium' as const, ...size(1024, 768) }; // the default cell (TS-TEST-29)

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0, // TS-TEST-31
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'UTC' },
  // The built app behind a nonce-templating server with the production CSP (REACT-SEC-09); run `npm run build` first.
  webServer: {
    command: 'node e2e/serve-dist.ts',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env['CI'],
  },
  projects: [
    { name: 'stubbed-expanded', use: expanded },
    { name: 'stubbed-dark', grep: /@theme/, use: { ...expanded, colorScheme: 'dark' } },
  ],
});
