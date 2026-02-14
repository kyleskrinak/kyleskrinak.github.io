import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for SEO meta tag tests
 * Narrowly scoped to seo-meta-tags.spec.ts to avoid running tests
 * with incompatible baseURL defaults (analytics-privacy.spec.ts and
 * console-errors.spec.ts both default to :3000, not :4321)
 */
export default defineConfig({
  testDir: './tests',
  testMatch: ['**/seo-meta-tags.spec.ts'],
  testIgnore: ['**/visual/**'],

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Only start dev server when testing against localhost
  // When PLAYWRIGHT_TEST_BASE_URL points to staging/production, skip webServer
  webServer:
    process.env.PLAYWRIGHT_TEST_BASE_URL &&
    !process.env.PLAYWRIGHT_TEST_BASE_URL.includes('localhost')
      ? undefined
      : {
          command: 'npm run dev',
          url: 'http://localhost:4321',
          reuseExistingServer: !process.env.CI,
        },
});
