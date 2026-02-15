import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for SEO-related tests (meta tags + sitemap)
 * Narrowly scoped to SEO tests only, excluding visual, analytics, and console tests.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: ['**/seo-meta-tags.spec.ts', '**/sitemap.spec.ts'],
  // Explicitly exclude non-SEO tests
  testIgnore: [
    '**/visual/**',
    '**/console-errors.spec.ts',
    '**/analytics-privacy.spec.ts',
    '**/analytics-privacy-ga.spec.ts',
  ],

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

  // Only start dev server when no explicit PLAYWRIGHT_TEST_BASE_URL is set
  // When PLAYWRIGHT_TEST_BASE_URL is provided (staging/production/local), skip webServer
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
      },
});
