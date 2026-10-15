/**
 * Shared URL verification logic using Playwright
 *
 * Used by check-links.js for both automated (htmltest + browser) and manual (browser-only) modes
 */

/**
 * Navigation failures that mean the host never answered in time. Like a 5xx,
 * a timeout says the server or the network path is unwell, not that the link
 * is wrong, so it counts as temporary. Other thrown errors stay broken: a DNS
 * failure (ERR_NAME_NOT_RESOLVED) is how a dead domain shows up, and refused
 * connections and TLS errors need a person to look.
 */
const TIMEOUT_ERROR_PATTERNS = [
  /Timeout \d+ms exceeded/,   // Playwright's own navigation timeout
  /net::ERR_TIMED_OUT\b/,
  /net::ERR_CONNECTION_TIMED_OUT\b/
];

export function isTimeoutError(error) {
  if (!error) return false;
  if (error.name === 'TimeoutError') return true;
  const message = String(error.message ?? '');
  return TIMEOUT_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

const NAVIGATION_TIMEOUT_MS = 30000;

// One retry separates a one-off stall (issue #412) from a host that never
// answers, at the cost of another 30s only for URLs that time out.
export const TIMEOUT_RETRIES = 1;

const isRedirectStatus = status => status >= 300 && status <= 399;

/**
 * Verify a URL by navigating to it with a real browser
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {string} url - URL to verify
 * @param {{ timeoutRetries?: number }} [options]
 * @returns {Promise<Object>} Verification result; `attempts` counts navigations
 */
export async function verifyUrl(page, url, { timeoutRetries = TIMEOUT_RETRIES } = {}) {
  let result;
  for (let attempt = 1; attempt <= timeoutRetries + 1; attempt++) {
    result = await attemptVerify(page, url);
    result.attempts = attempt;
    if (!result.timedOut) break;
  }
  return result;
}

async function attemptVerify(page, url) {
  // waitUntil 'load' also waits on every subresource, so one hanging tracker
  // script makes goto() throw a timeout after the server has already sent the
  // document — 200 or 404. Keep the main frame's last navigation response so
  // that status still decides the bucket; only a host that never sent the
  // document counts as timed out. A 3xx as the last response means the
  // redirect target never answered, which is a real timeout.
  let documentResponse = null;
  const onResponse = response => {
    try {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) {
        documentResponse = response;
      }
    } catch {
      // Frame detached mid-navigation; nothing to record.
    }
  };
  page.on('response', onResponse);

  try {
    let response;
    let loadTimedOut = false;
    try {
      response = await page.goto(url, {
        waitUntil: 'load',
        timeout: NAVIGATION_TIMEOUT_MS
      });
    } catch (error) {
      const answered = documentResponse && !isRedirectStatus(documentResponse.status());
      if (!(isTimeoutError(error) && answered)) throw error;
      response = documentResponse;
      loadTimedOut = true;
    }

    const status = response ? response.status() : 'NO_RESPONSE';
    const headers = response ? response.headers() : {};
    const retryAfter = headers['retry-after'];

    // Three distinct flavors of "not broken":
    //   reachable: 2xx — the page actually loaded for the browser
    //   withheld: 403/999 — the resource exists but gates automated clients;
    //             429 — rate-limited/bot-gated (does NOT imply resource exists)
    //   temporary: any 5xx — the host answered but could not serve the page.
    //     Link rot is a 4xx condition; a 5xx says the server is unwell, not
    //     that the link is wrong, so it never counts as broken. A navigation
    //     timeout (catch path below) is temporary for the same reason.
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
      timedOut: false,
      loadTimedOut,
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
    const timedOut = isTimeoutError(error);
    return {
      url,
      finalUrl,
      redirected: finalUrl !== url,
      error: error.message,
      reachable: false,
      withheld: false,
      temporary: timedOut,
      timedOut,
      loadTimedOut: false,
      success: timedOut
    };
  } finally {
    page.off('response', onResponse);
  }
}
