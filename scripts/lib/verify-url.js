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

    // Three distinct flavors of "not broken":
    //   reachable: 2xx — the page actually loaded for the browser
    //   withheld: 403/999 — the resource exists but gates automated clients;
    //             429 — rate-limited/bot-gated (does NOT imply resource exists)
    //   temporary: 503 maintenance page requiring explicit maintenance-mode
    //     page content; Retry-After treated as corroborating evidence only.
    // success keeps the broad "not broken" meaning so callers that only
    // care about pass/fail don't have to inspect both flags.
    const reachable = !!(response && response.ok());
    const withheld = !!(response && (status === 403 || status === 429 || status === 999));
    let maintenanceSignals = [];
    if (status === 503) {
      // Require explicit maintenance-mode page content as the primary signal.
      // Retry-After alone is too broad — servers also send it for overload,
      // abuse mitigation, and transient outages. Only treat it as corroborating
      // evidence when page content already confirms a maintenance window.
      const pageHtml = (await page.content()).toLowerCase();
      const maintenanceMarkers = [
        'scheduled maintenance',
        'under maintenance',
        'maintenance mode'
      ];

      if (maintenanceMarkers.some(marker => pageHtml.includes(marker))) {
        maintenanceSignals.push('maintenance page content');
        if (retryAfter) {
          maintenanceSignals.push(`Retry-After: ${retryAfter}`);
        }
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
