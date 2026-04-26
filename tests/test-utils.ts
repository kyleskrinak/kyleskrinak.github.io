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
 * Stub Disqus so async-loading comments can't flake visual snapshots or
 * pollute console-error captures.
 *
 * Strategy:
 * - Fulfill embed.js with a tiny no-op script that pretends the embed
 *   loaded successfully: it inserts a placeholder child into
 *   #disqus_thread (so the component's MutationObserver clears the 6s
 *   slow-load fallback timer) and stubs window.DISQUS so the theme
 *   observer's reset() call is a harmless no-op.
 * - Fulfill all other disqus.com / disquscdn.com requests with a silent
 *   204, avoiding Chromium's "Failed to load resource" console errors
 *   that route.abort() would surface.
 *
 * Why a stub over route.abort() or a 204 for embed.js:
 * - route.abort() emits net::ERR_FAILED in console.
 * - 204 makes embed.js look "successful" but never executes, so the
 *   thread stays empty and the 6s fallback timer eventually reveals the
 *   "Comments could not be loaded" message — capturable in a snapshot
 *   if a test runs slowly.
 * - The stub guarantees the rendered DOM is identical and deterministic
 *   regardless of test timing.
 */
export async function blockDisqus(page: import("@playwright/test").Page) {
  await page.route(/disqus\.com\/embed\.js/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `(function(){var t=document.getElementById('disqus_thread');if(t)t.innerHTML='<div data-test-stub="disqus"></div>';window.DISQUS={reset:function(){}};})();`,
    })
  );
  // Catch-all uses a negative lookahead so it cannot match embed.js.
  // Playwright runs handlers in reverse registration order, so without the
  // exclusion the catch-all (registered second) would 204 the embed.js
  // request before the stub handler ever ran.
  await page.route(/disqus(?:cdn)?\.com\/(?!embed\.js)/, (route) =>
    route.fulfill({ status: 204, body: "" })
  );
}
