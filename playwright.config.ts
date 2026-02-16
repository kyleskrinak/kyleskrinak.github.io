import { defineConfig, devices } from '@playwright/test';

/**
 * Unified Playwright configuration for all test types
 * Uses projects to organize tests by category (visual, SEO, analytics)
 */
export default defineConfig({
  // Global test timeout settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Shared settings for all tests
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4321',
    trace: 'on-first-retry',
  },

  // Organize tests by type using projects
  projects: [
    {
      name: 'visual-desktop',
      testDir: './tests/visual',
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'off', // Visual tests handle screenshots themselves
      },
    },
    {
      name: 'visual-mobile',
      testDir: './tests/visual',
      use: {
        ...devices['iPhone 12'],
        screenshot: 'off',
      },
    },
    {
      name: 'seo',
      testDir: './tests/seo',
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'only-on-failure',
      },
    },
    {
      name: 'analytics',
      testDir: './tests/analytics',
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'only-on-failure',
      },
    },
    {
      name: 'console',
      testMatch: 'tests/console-errors.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'only-on-failure',
      },
    },
    {
      name: 'links',
      testMatch: 'tests/link-validation.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'only-on-failure',
      },
    },
  ],

  // Reporter: HTML for visual tests (detailed), list for others
  reporter: process.env.CI ? 'list' : [
    ['list'],
    ['html', { open: 'never' }],
  ],

  // Auto-start dev server when testing localhost
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
        env: {
          DISABLE_DEV_TOOLBAR: 'true',
        },
      },
});
