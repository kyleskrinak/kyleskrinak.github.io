import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './tests/test-utils';

/**
 * Refuse to write snapshots from a non-Linux host.
 *
 * Committed baselines are compared against CI's Ubuntu rendering, whose font stack
 * renders slightly taller than macOS. Snapshots written on any other host overwrite
 * committed files with pixels CI will reject. scripts/visual-test.sh guards its own
 * `baseline` mode, but every other entry point -- `npm run test:visual -- -u`, a bare
 * `npx playwright test -u` -- bypasses that script entirely, so the check lives here
 * where all of them pass through. Docker and CI both run Linux, so the modes that are
 * meant to write baselines are unaffected.
 *
 * ALLOW_NATIVE_BASELINE=1 is the deliberate escape hatch.
 */
const snapshotUpdateModes = (argv: string[]): string[] => {
  const modes: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--update-snapshots=')) {
      modes.push(arg.slice('--update-snapshots='.length));
      continue;
    }
    if (arg === '--update-snapshots' || arg === '-u') {
      // Playwright's mode value is optional, so the next token is only the mode when
      // it is not another flag. A positional filter read as a mode is harmless: it is
      // simply not 'none', which fails safe toward refusing the run.
      const next = argv[i + 1];
      modes.push(next !== undefined && !next.startsWith('-') ? next : 'changed');
    }
  }
  return modes;
};

// Every occurrence counts, not just the first: Playwright takes the last one, so a
// leading `--update-snapshots=none` must not mask a later `--update-snapshots=all`.
// Any non-'none' mode is enough to refuse.
const writesSnapshots = snapshotUpdateModes(process.argv).some((mode) => mode !== 'none');
if (
  writesSnapshots &&
  process.platform !== 'linux' &&
  process.env.ALLOW_NATIVE_BASELINE !== '1'
) {
  throw new Error(
    [
      `Refusing to write snapshots from a ${process.platform} host.`,
      '',
      "Committed baselines must match CI's Ubuntu rendering. Use:",
      '  npm run test:visual:baseline:docker',
      '',
      'To override anyway (only correct on a Linux host matching CI):',
      '  ALLOW_NATIVE_BASELINE=1 <command>',
    ].join('\n')
  );
}

/**
 * Unified Playwright configuration for all test types
 * Uses projects to organize tests by category (visual, SEO, analytics)
 */
export default defineConfig({
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
