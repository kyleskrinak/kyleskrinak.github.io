/**
 * Shared URL verification logic using Playwright
 *
 * Used by check-links.js for both automated (htmltest + browser) and manual (browser-only) modes
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

    // 403 (access-controlled) and 999 (LinkedIn-style anti-bot) mean the
    // resource exists but is gated against automated clients. Treat both
    // as success so headless verification doesn't false-positive them as
    // broken when their htmltest equivalent already flagged the same gate.
    const isSuccess = response && (response.ok() || status === 403 || status === 999);

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
