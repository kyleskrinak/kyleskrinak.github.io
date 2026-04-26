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

    // Two distinct flavors of "not broken":
    //   reachable: 2xx — the page actually loaded for the browser
    //   withheld: 403/999 — the resource exists but gates automated
    //     clients. Same semantic class as a 403 from htmltest.
    // success keeps the broad "not broken" meaning so callers that only
    // care about pass/fail don't have to inspect both flags.
    const reachable = !!(response && response.ok());
    const withheld = !!(response && (status === 403 || status === 999));

    return {
      url,
      status,
      finalUrl: page.url(),
      redirected: page.url() !== url,
      reachable,
      withheld,
      success: reachable || withheld
    };
  } catch (error) {
    return {
      url,
      error: error.message,
      reachable: false,
      withheld: false,
      success: false
    };
  }
}
