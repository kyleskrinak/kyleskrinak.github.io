/**
 * Shared test utilities and constants
 */

/**
 * Dedicated local preview port for the Playwright suite.
 *
 * Port allocation across this repo, so the number is explained in one place:
 *   4321 - `astro dev`, `npm run preview`, CI, and scripts/build-archive-pdf.mjs
 *   4322 - this suite's preview server, deliberately not 4321 so a dev server
 *          left running does not collide with a test run
 *   4323 - the resume PDF renderer
 *
 * scripts/visual-test.sh mirrors this value as a shell default (it cannot import
 * TypeScript); the two must stay in sync, and that script's comment says so.
 */
export const PREVIEW_PORT = 4322;

/**
 * Base URL for tests - defaults to this project's dedicated local preview port.
 * Override with PLAYWRIGHT_TEST_BASE_URL for staging/production testing.
 */
export const BASE_URL =
  process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${PREVIEW_PORT}`;

/**
 * Detect staging environment from URL pattern or explicit env var
 * Used by tests to adjust expectations (staging has noindex,nofollow on all pages)
 *
 * Detection priority:
 * 1. BASE_URL contains 'github.io' (auto-detect staging URL)
 * 2. PLAYWRIGHT_DEPLOY_ENV explicitly set to 'staging' (test-side: runs staging-only tests)
 * 3. PUBLIC_DEPLOY_ENV explicitly set to 'staging' (app-side: makes app render staging meta tags)
 *
 * For local staging testing, set both environment variables:
 *   PUBLIC_DEPLOY_ENV=staging (makes app render staging meta tags)
 *   PLAYWRIGHT_DEPLOY_ENV=staging (makes test suite run staging-only tests)
 */
export const isStaging =
  BASE_URL.includes('github.io') ||
  process.env.PLAYWRIGHT_DEPLOY_ENV === 'staging' ||
  process.env.PUBLIC_DEPLOY_ENV === 'staging';

/**
 * Detect if BASE_URL is a local development URL
 * Analytics and other production-only features skip tests on local URLs
 *
 * Returns true if:
 * - PLAYWRIGHT_TEST_BASE_URL is not set (defaults to localhost)
 * - BASE_URL contains localhost, 127.0.0.1, .local, or ::1
 */
export const isLocalUrl =
  !process.env.PLAYWRIGHT_TEST_BASE_URL ||
  BASE_URL.includes("localhost") ||
  BASE_URL.includes("127.0.0.1") ||
  BASE_URL.includes(".local") ||
  BASE_URL.includes("::1");
