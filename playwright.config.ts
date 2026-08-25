import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, PREVIEW_PORT } from './tests/test-utils';

/**
 * Unified Playwright configuration for all test types
 * Uses projects to organize tests by category (visual, SEO, analytics)
 */
export default defineConfig({
  globalSetup: './tests/global-snapshot-guard.ts',
  globalTeardown: './tests/global-snapshot-teardown.ts',

  // Omit the OS/platform suffix ({-snapshotSuffix}) so baselines committed on macOS
  // resolve correctly on Linux CI. Default template with that token removed.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{-projectName}{ext}',

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
  // pre-bundling issues (504 Outdated Optimize Dep errors). The port comes from
  // tests/test-utils.ts, which documents why it is not the dev server's.
  // Uses build:ci (not build) to skip the public/ pagefind copy step.
  // reuseExistingServer is false to ensure fresh builds (avoids stale build issues).
  //
  // ASTRO_PREVIEW_BACKGROUND is set because Astro detaches `astro preview` into a
  // background process when it detects an agent session (am-i-vibing, keyed on
  // CLAUDECODE among others), and only an unset variable enables that detection --
  // any value, including 0, turns it off. Detached, the server outlives the run:
  // Playwright's teardown kills a child it no longer owns, the listener survives,
  // and every later run dies on Astro's PID lock. Keeping it in the foreground is
  // what makes the server die with the test run that started it.
  //
  // It goes in `env` rather than inline in `command` because an inline VAR=value
  // prefix is shell syntax, and cmd.exe/PowerShell would take it as the program
  // name. `env` merges over process.env, so the whole command still inherits PATH
  // and the rest; build:ci also sees the variable and simply ignores it.
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: `npm run build:ci && npx astro preview --host localhost --port ${PREVIEW_PORT}`,
        env: { ASTRO_PREVIEW_BACKGROUND: '0' },
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
