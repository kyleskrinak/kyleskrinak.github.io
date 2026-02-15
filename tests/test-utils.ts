/**
 * Shared test utilities and constants
 */

/**
 * Base URL for tests - defaults to Astro dev server port
 * Override with PLAYWRIGHT_TEST_BASE_URL for staging/production testing
 */
export const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4321';

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
