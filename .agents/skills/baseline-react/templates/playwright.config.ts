import { defineConfig } from '@playwright/test';

// Projects per TS-TEST-18 (tiers), TS-TEST-28 (themes) and TS-TEST-29 (one dimension per project from the default cell).
const touch = { isMobile: true, hasTouch: true }; // isMobile isn't supported in Firefox: leave it out there
const size = (width: number, height: number) => ({ viewport: { width, height } });
const expanded = { browserName: 'chromium' as const, ...size(1024, 768) }; // the default cell (TS-TEST-29)
const responsive = { grep: /@responsive/ };
const themed = { grep: /@theme/ };
const stubbed = { testIgnore: 'smoke/**' }; // the stubbed tier never runs the real-backend specs

// e2e:smoke runs against a real BFF and backend (TS-TEST-10), e.g. the local stack or a test environment.
const smokeBaseUrl = process.env['SMOKE_BASE_URL'];

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0, // TS-TEST-31
  workers: process.env['CI'] ? 2 : undefined, // capped in CI: load-dependent timing is not a fix (TS-TEST-31)
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: smokeBaseUrl ?? 'http://localhost:4173',
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  // The built app behind a nonce-templating server with the production CSP (REACT-SEC-09); run `npm run build` first.
  ...(smokeBaseUrl === undefined && {
    webServer: {
      command: 'node e2e/serve-dist.ts',
      url: 'http://localhost:4173/',
      reuseExistingServer: !process.env['CI'],
    },
  }),
  projects: [
    // T1, every pull request: npm run e2e (playwright test --project=stubbed-*)
    { name: 'stubbed-expanded', ...stubbed, use: expanded },
    { name: 'stubbed-dark', ...stubbed, ...themed, use: { ...expanded, colorScheme: 'dark' } },
    // Verify before first use: the T1 projects below were not run in the validation project (REACT-TEST-21).
    { name: 'stubbed-firefox-expanded', ...stubbed, use: { ...expanded, browserName: 'firefox' } },
    { name: 'stubbed-webkit-expanded', ...stubbed, use: { ...expanded, browserName: 'webkit' } },
    {
      name: 'stubbed-compact',
      ...stubbed,
      ...responsive,
      use: { browserName: 'chromium', ...size(390, 844), ...touch },
    },
    {
      name: 'stubbed-medium',
      ...stubbed,
      ...responsive,
      use: { browserName: 'chromium', ...size(768, 1024), hasTouch: true },
    },
    { name: 'stubbed-reflow', ...stubbed, ...responsive, use: { browserName: 'chromium', ...size(320, 800) } },
    { name: 'stubbed-high-contrast', ...stubbed, ...themed, use: { ...expanded, contrast: 'more' } },
    { name: 'stubbed-forced-colors', ...stubbed, grep: /@shell/, use: { ...expanded, forcedColors: 'active' } },
    // T2, nightly on the main branch: npm run e2e:nightly (adds --project=nightly-*). Verify before first use.
    { name: 'nightly-large', ...stubbed, ...responsive, use: { browserName: 'chromium', ...size(1440, 900) } },
    { name: 'nightly-extra-large', ...stubbed, ...responsive, use: { browserName: 'chromium', ...size(1920, 1080) } },
    {
      name: 'nightly-compact-landscape',
      ...stubbed,
      ...responsive,
      use: { browserName: 'chromium', ...size(844, 390), ...touch },
    },
    {
      name: 'nightly-webkit-compact',
      ...stubbed,
      ...responsive,
      use: { browserName: 'webkit', ...size(390, 844), ...touch },
    },
    {
      name: 'nightly-firefox-compact',
      ...stubbed,
      ...responsive,
      use: { browserName: 'firefox', ...size(390, 844), hasTouch: true },
    },
    // Full-stack system test (TS-TEST-10): npm run e2e:smoke with SMOKE_BASE_URL set. Verify before first use.
    { name: 'smoke', testMatch: 'smoke/**/*.spec.ts', use: expanded },
  ],
});
