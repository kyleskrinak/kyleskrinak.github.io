/**
 * Classification of tier-2 browser results into report buckets.
 *
 * Kept free of I/O so the bucketing that decides check-links.js's exit code
 * can be unit-tested without htmltest or a browser.
 */

// Domains that require authentication to verify.
// Unauthenticated browsers receive bot-detection errors or login-wall responses
// that are indistinguishable from genuine 404s — so failures are reported for
// manual review rather than failing CI.
const AUTH_REQUIRED_DOMAINS = ['linkedin.com'];

export const isAuthRequiredDomain = url => {
  try {
    const { hostname } = new URL(url);
    return AUTH_REQUIRED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
};

// The only htmltest statuses that say the resource is gone. Every other 4xx
// is about the request, not the link: 401/403 and 429 are gates, 405 is the
// method htmltest used, 408 is the server timing out on htmltest too, and
// 407/421/425 are proxy, routing, or timing problems. Listing the link-rot
// codes rather than the exceptions keeps an unlisted code from failing CI.
const LINK_ROT_STATUSES = new Set([404, 410]);

const is5xx = status => typeof status === 'number' && status >= 500 && status <= 599;

/**
 * A browser timeout says nothing about the resource, so it must not override
 * a definite answer htmltest already got. When htmltest saw a 404 or 410,
 * the timeout result is demoted to broken and carries htmltest's status as
 * the reason. Any other result passes through unchanged.
 *
 * @param {Object} result - verifyUrl result
 * @param {number|null|undefined} htmltestStatus - htmltest's status for the URL
 * @returns {Object} the result, or a broken copy of it
 */
export function applyHtmltestEvidence(result, htmltestStatus) {
  if (!result.timedOut) return result;
  if (!LINK_ROT_STATUSES.has(htmltestStatus)) return result;
  return {
    ...result,
    temporary: false,
    success: false,
    error: `htmltest reported ${htmltestStatus}; browser timed out (${result.error})`
  };
}

/**
 * @param {Object} args
 * @param {Object[]} args.results - verifyUrl results, after applyHtmltestEvidence
 * @param {Map<string, number|null>} args.statusByUrl - htmltest status per URL
 * @param {boolean} args.isManualMode - no htmltest statuses exist in manual mode
 */
export function bucketLinkResults({ results, statusByUrl, isManualMode }) {
  // notBrokenResults includes reachable (2xx), withheld (403/429/999), and
  // temporary (any 5xx, or a navigation timeout) URLs.
  // kept as a single set for sectioning logic that doesn't care which flavor.
  const notBrokenResults = results.filter(r => r.success);
  const reachableResults = results.filter(r => r.reachable);
  const withheldResults = results.filter(r => r.withheld);
  const temporaryResults = results.filter(r => r.temporary);
  // Timeouts carry no browser status, so the 5xx detail sections below skip them
  // and they get a section of their own.
  const timedOutResults = temporaryResults.filter(r => r.timedOut);
  const broken = results.filter(r => !r.success);

  // HTTP 429 = rate-limited/bot-gated: both htmltest and browser were gated.
  // Drawn from withheldResults (browser confirmed gated) so that any 429 URL where
  // the browser found a genuine failure (404/500/TLS) stays in trulyBroken instead.
  // (Only meaningful in automated mode where htmltest status codes are available.)
  const htmltest429s = !isManualMode
    ? withheldResults.filter(r => statusByUrl.get(r.url) === 429)
    : [];
  // Separate auth-required domains (e.g. LinkedIn) from genuinely broken links.
  // Auth-required URLs are reported for manual review but do not fail CI.
  // Classify by effective URL (prefer finalUrl to catch cases where a redirect
  // lands on — or away from — an auth-required domain) and partition in one pass.
  const unverifiable = [];
  const trulyBroken = [];
  for (const r of broken) {
    if (isAuthRequiredDomain(r.finalUrl || r.url)) {
      unverifiable.push(r);
    } else {
      trulyBroken.push(r);
    }
  }

  // Summary counts segmented by browser status so labels match actual bucket contents.
  // withheld403_999: browser returned 403 or 999 (policy blocks, resource exists)
  // withheld429:     browser returned 429 (rate-limited/bot-gated)
  // Both are non-broken; kept separate because they have different operator meanings.
  const withheld403_999Count = withheldResults.filter(r => r.status === 403 || r.status === 999).length;
  const withheld429Count = withheldResults.filter(r => r.status === 429).length;

  // In automated mode, categorize non-broken URLs by their htmltest status for detailed reporting
  // Manual mode doesn't have htmltest status, so skip this categorization
  //
  // Naming convention: arrays prefixed with `htmltest` are keyed on the htmltest
  // status code; arrays prefixed with `browser` are keyed on the browser result.
  // Mixing the two created a reporting gap (Copilot, PR #105 round 4) where a
  // browser-withheld URL whose htmltest status was non-policy (e.g., 404) would
  // be counted in the summary but appear in no detail section.
  let ignoreCandidates = [];
  let htmltest403s = [];
  let htmltest999s = [];
  let htmltest5xxTemporaries = [];
  let browserWithheldOther = [];
  let browserTemporaryOther = [];
  let connectionErrors = [];

  if (!isManualMode) {
    // Include: URLs the browser actually reached (HTTP 2xx) AND whose htmltest
    //   failure had an explicit non-policy status (404, 429, 503, etc.)
    // Exclude:
    //   - browser-withheld URLs (403/429/999) — gated against automation, not safe
    //     to auto-suggest as a permanent ignore even if htmltest's status differs
    //   - htmltest 403/999 — withheld by policy regardless of browser outcome
    //   - htmltest null/undefined — TLS/connection errors, kept visible for investigation
    //   - auth-required domains (e.g. linkedin.com) — policy says never add these to
    //     IgnoreURLs; use the unverifiable category instead (PR #121)
    ignoreCandidates = reachableResults.filter(r => {
      const status = statusByUrl.get(r.url);
      return status !== 403 && status !== 999 && status !== null && status !== undefined
        && !isAuthRequiredDomain(r.finalUrl || r.url);
    });
    htmltest403s = notBrokenResults.filter(r => statusByUrl.get(r.url) === 403 && !r.temporary);
    htmltest999s = notBrokenResults.filter(r => statusByUrl.get(r.url) === 999 && !r.temporary);
    // Any 5xx, not only 503: hosts shed load with whatever code they favour
    // (500, 502, 503, 504) and all of them mean the same thing here.
    htmltest5xxTemporaries = temporaryResults.filter(r => !r.timedOut && is5xx(statusByUrl.get(r.url)));
    connectionErrors = notBrokenResults.filter(r =>
      !r.timedOut && (statusByUrl.get(r.url) === null || statusByUrl.get(r.url) === undefined));
    // Catch browser-withheld URLs whose htmltest status doesn't match any policy
    // bucket above, so every URL counted in the withheld summary appears in some
    // detail section. Exclude 429 — those are already covered by htmltest429s,
    // and including them here would produce duplicate detail output.
    browserWithheldOther = withheldResults.filter(r => {
      const status = statusByUrl.get(r.url);
      return status !== 403 && status !== 429 && status !== 999 && status !== null && status !== undefined;
    });
    browserTemporaryOther = temporaryResults.filter(r => {
      if (r.timedOut) return false;
      const status = statusByUrl.get(r.url);
      if (status === null || status === undefined) return false;
      return !is5xx(status);
    });
  }

  return {
    notBrokenResults,
    reachableResults,
    withheldResults,
    temporaryResults,
    timedOutResults,
    htmltest429s,
    unverifiable,
    trulyBroken,
    withheld403_999Count,
    withheld429Count,
    ignoreCandidates,
    htmltest403s,
    htmltest999s,
    htmltest5xxTemporaries,
    browserWithheldOther,
    browserTemporaryOther,
    connectionErrors
  };
}
