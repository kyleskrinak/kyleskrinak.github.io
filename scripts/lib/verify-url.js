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
    //   temporary: any 5xx — the host answered but could not serve the page.
    //     Link rot is a 4xx condition; a 5xx says the server is unwell, not
    //     that the link is wrong, so it never counts as broken.
    // success keeps the broad "not broken" meaning so callers that only
    // care about pass/fail don't have to inspect both flags.
    //
    // This bucket previously required explicit maintenance-page content to
    // admit a 503, which made overload and abuse-mitigation 503s — the kind
    // GitHub returns to CI runner IPs — report as permanently broken and
    // demand manual fixes that could not be made. Maintenance markers are
    // still collected below, as reporting detail rather than the entry
    // condition.
    const reachable = !!(response && response.ok());
    const withheld = !!(response && (status === 403 || status === 429 || status === 999));
    // Only a numeric status can be a 5xx: `status` is the string 'NO_RESPONSE'
    // when the browser got no response object at all, which stays broken.
    const temporary = typeof status === 'number' && status >= 500 && status <= 599;
    let maintenanceSignals = [];
    if (status === 503) {
      // Distinguishes a declared maintenance window from generic overload.
      // Both are temporary, so this only enriches the report. Retry-After
      // stays corroborating evidence — servers also send it for overload and
      // abuse mitigation, so it is never a primary signal.
      let pageHtml = '';
      try {
        pageHtml = (await page.content()).toLowerCase();
      } catch {
        // Content unavailable (frame detached, navigation raced). The 5xx
        // classification above already stands; markers are optional detail,
        // so swallow this rather than demoting the URL to broken.
      }
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
    // Capture the last URL Playwright navigated to before the error, so
    // redirect-aware bucketing (e.g. isAuthRequiredDomain) works even when
    // page.goto() throws mid-redirect. Fall back to the original url if
    // Playwright hasn't navigated yet (page.url() returns 'about:blank').
    const currentUrl = page.url();
    const finalUrl = (currentUrl && currentUrl !== 'about:blank') ? currentUrl : url;
    return {
      url,
      finalUrl,
      redirected: finalUrl !== url,
      error: error.message,
      reachable: false,
      withheld: false,
      temporary: false,
      success: false
    };
  }
}
