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

    return {
      url,
      status,
      finalUrl: page.url(),
      redirected: page.url() !== url,
      success: response && response.ok()
    };
  } catch (error) {
    return {
      url,
      error: error.message,
      success: false
    };
  }
}
