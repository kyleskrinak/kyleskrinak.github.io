/**
 * Shared URL verification logic using Playwright
 *
 * Used by both check-links.js (automated) and verify-links-with-browser.js (manual)
 */

/**
 * Verify a URL by navigating to it with a real browser
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {string} url - URL to verify
 * @returns {Promise<Object>} Verification result
 */
export async function verifyUrl(page, url) {
  try {
    const response = await page.goto(url, {
      waitUntil: 'load',
      timeout: 30000
    });

    const status = response ? response.status() : 'NO_RESPONSE';

    // 403 means resource exists (access-controlled), not broken
    // Accept 2xx (OK) and 403 (Forbidden) as success
    const isSuccess = response && (response.ok() || status === 403);

    return {
      url,
      status,
      finalUrl: page.url(),
      redirected: page.url() !== url,
      success: !!isSuccess
    };
  } catch (error) {
    return {
      url,
      error: error.message,
      success: false
    };
  }
}
