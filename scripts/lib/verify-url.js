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
    const headers = response ? response.headers() : {};
    const retryAfter = headers['retry-after'];

    // Two distinct flavors of "not broken":
    //   reachable: 2xx — the page actually loaded for the browser
    //   withheld: 403/429/999 — the resource exists but gates automated
    //     clients. Same semantic class as those statuses from htmltest.
    //   temporary: 503 maintenance page with strong signals such as
    //     Retry-After or explicit maintenance-mode page content.
    // success keeps the broad "not broken" meaning so callers that only
    // care about pass/fail don't have to inspect both flags.
    const reachable = !!(response && response.ok());
    const withheld = !!(response && (status === 403 || status === 429 || status === 999));
    let maintenanceSignals = [];
    if (status === 503) {
      if (retryAfter) {
        maintenanceSignals.push(`Retry-After: ${retryAfter}`);
      }

      const pageHtml = (await page.content()).toLowerCase();
      const maintenanceMarkers = [
        'scheduled maintenance',
        'under maintenance',
        'maintenance mode',
        'please check back soon',
        'temporarily unavailable'
      ];

      if (maintenanceMarkers.some(marker => pageHtml.includes(marker))) {
        maintenanceSignals.push('maintenance page content');
      }
    }
    const temporary = status === 503 && maintenanceSignals.length > 0;

    return {
      url,
      status,
      finalUrl: page.url(),
      redirected: page.url() !== url,
      reachable,
      withheld,
      temporary,
      retryAfter,
      maintenanceSignals,
      success: reachable || withheld || temporary
    };
  } catch (error) {
    return {
      url,
      error: error.message,
      reachable: false,
      withheld: false,
      temporary: false,
      success: false
    };
  }
}
