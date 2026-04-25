/**
 * Shared test utilities and constants
 */

/**
 * Base URL for tests - defaults to this project's dedicated local preview port (4322).
 * Port 4322 intentionally differs from the local dev server port (4321) to prevent conflicts.
 * Override with PLAYWRIGHT_TEST_BASE_URL for staging/production testing.
 */
export const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4322';

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

/**
 * Block all Disqus traffic so async-loading comments can't flake
 * visual snapshots or pollute console-error captures with third-party
 * warnings. The page still renders #disqus_thread (empty) and the
 * fallback message — but no remote content loads.
 */
export async function blockDisqus(page: import("@playwright/test").Page) {
  await page.route(/disqus(?:cdn)?\.com/, (route) => route.abort());
}
