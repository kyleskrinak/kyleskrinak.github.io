import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './tests/test-utils';

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
    baseURL: BASE_URL,
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
    {
      name: 'layout',
      testMatch: 'tests/layout-consistency.spec.ts',
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

  // Run against production build (not dev server) to avoid Vite 7 dep
  // pre-bundling issues (504 Outdated Optimize Dep errors). Port 4322
  // intentionally differs from dev server (4321) to prevent conflicts.
  // Uses build:ci (not build) to skip the public/ pagefind copy step.
  // reuseExistingServer is false to ensure fresh builds (avoids stale build issues).
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: 'npm run build:ci && npx astro preview --port 4322',
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
