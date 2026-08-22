import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './tests/test-utils';
import { argvRequestsSnapshotWrites, assertSnapshotWritesAllowed } from './tests/snapshot-guard';

/**
 * Refuse to write snapshots from a host whose rendering doesn't match CI.
 *
 * scripts/visual-test.sh guards only its own `baseline` mode, so every other entry
 * point -- `npm run test:visual -- -u`, a bare `npx playwright test -uall` -- would
 * otherwise overwrite committed PNGs with host-rendered pixels CI rejects.
 *
 * Two layers, because argv spellings kept slipping past a scan (`-uall` and `-xu`
 * both reach --update-snapshots): this fast path refuses common cases before the
 * webServer build starts, and globalSetup re-checks Playwright's own parsed
 * `config.updateSnapshots`, which cannot be evaded at all.
 *
 * ALLOW_NATIVE_BASELINE=1 is the deliberate escape hatch for both.
 */
assertSnapshotWritesAllowed(argvRequestsSnapshotWrites(process.argv));

/**
 * Unified Playwright configuration for all test types
 * Uses projects to organize tests by category (visual, SEO, analytics)
 */
export default defineConfig({
  globalSetup: './tests/global-snapshot-guard.ts',

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
  // pre-bundling issues (504 Outdated Optimize Dep errors). Port 4322
  // intentionally differs from dev server (4321) to prevent conflicts.
  // Uses build:ci (not build) to skip the public/ pagefind copy step.
  // reuseExistingServer is false to ensure fresh builds (avoids stale build issues).
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: 'npm run build:ci && npx astro preview --host localhost --port 4322',
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
