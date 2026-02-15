/**
 * Shared test utilities and constants
 */

/**
 * Base URL for tests - defaults to Astro dev server port
 * Override with PLAYWRIGHT_TEST_BASE_URL for staging/production testing
 */
export const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4321';

/**
 * Detect staging environment from URL pattern
 * Used by tests to adjust expectations (staging has noindex,nofollow on all pages)
 */
export const isStaging = BASE_URL.includes('github.io');
