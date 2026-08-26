/**
 * Shared test utilities and constants
 */

/**
 * Dedicated local preview port for the Playwright suite.
 *
 * Port allocation across this repo, so the number is explained in one place:
 *   4321 - `astro dev`, `npm run preview`, CI
 *   4322 - this suite's preview server, deliberately not 4321 so a dev server
 *          left running does not collide with a test run
 *   4323 - the resume PDF renderer (RESUME_PREVIEW_PORT)
 *   4324 - the blog archive PDF renderer (ARCHIVE_PREVIEW_PORT)
 *
 * No script defaults to 4321: one that did would find the port already bound
 * whenever a dev server was up, and `astro preview` cannot serve dist/ there.
 * scripts/lib/pdf-helpers.mjs carries the same table for the PDF scripts.
 *
 * scripts/visual-test.sh mirrors this value as a literal (it cannot import
 * TypeScript, and deliberately honours no override -- a guard on a port the run
 * does not take is worse than no guard); the two must stay in sync, and that
 * script's comment says so.
 */
export const PREVIEW_PORT = 4322;

/**
 * Base URL for tests - defaults to this project's dedicated local preview port.
 * Override with PLAYWRIGHT_TEST_BASE_URL for staging/production testing.
 */
export const BASE_URL =
  process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${PREVIEW_PORT}`;

/**
 * Detect staging environment from explicit env vars only.
 * Used by tests to adjust expectations (staging has noindex,nofollow on all pages)
 *
 * `BASE_URL` containing 'github.io' is deliberately NOT used to auto-detect staging:
 * kyleskrinak.github.io is now a manual disaster-recovery fallback (see
 * docs/operations/staging-url-reference.md) that either serves a static redirect
 * stub or, during a `mode=full-fallback` dispatch, an Astro build with
 * `PUBLIC_DEPLOY_ENV=production` — never `staging`. Auto-detecting staging from the
 * URL would make SEO tests assert noindex,nofollow against a deploy that is meant
 * to be indexable.
 *
 * Detection priority:
 * 1. PLAYWRIGHT_DEPLOY_ENV explicitly set to 'staging' (test-side: runs staging-only tests)
 * 2. PUBLIC_DEPLOY_ENV explicitly set to 'staging' (app-side: makes app render staging meta tags)
 *
 * For local staging testing, set both environment variables:
 *   PUBLIC_DEPLOY_ENV=staging (makes app render staging meta tags)
 *   PLAYWRIGHT_DEPLOY_ENV=staging (makes test suite run staging-only tests)
 */
export const isStaging =
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
