/**
 * Parse htmltest output into the set of external URLs worth re-checking in a
 * real browser (tier 2 of the two-tier link check).
 *
 * Extracted from check-links.js so the parsing can be tested directly: the
 * orchestrator runs htmltest, exits the process and launches Chromium, none of
 * which belongs in a unit test.
 */

// htmltest prints every failure as:
//
//   <message> --- <document> --> <target>
//
// e.g.
//   Non-OK status: 403 --- about/index.html --> https://www.npmjs.com/
//   request exceeded our ExternalTimeout --- index.html --> http://10.0.0.1/x
//   Get "http://h/x": dial tcp: lookup h: no such host --- index.html --> http://h/x
//
// Matching that shape, and requiring the target to be an http(s) URL, is what
// makes this robust. The previous implementation listed message substrings
// ('Non-OK status', 'Get "http', 'tls:') and so silently dropped any failure
// whose wording was not on the list — most importantly htmltest's timeout,
// 'request exceeded our ExternalTimeout', which names no URL scheme in its
// message. A URL dropped here reaches no bucket at all: it fails the gate
// without ever being named in the report. Matching the line structure instead
// of the prose means a new or reworded htmltest message cannot reintroduce
// that hole.
const FAILURE_LINE = /\s---\s+\S+\s+-->\s+(https?:\/\/\S+?)[\s"':)\]]*$/;

// Internal-target failures (alt text, missing files, directory slashes) use the
// same line shape with a non-URL target, so FAILURE_LINE skips them: the
// browser has nothing to verify for those and they are reported by htmltest
// directly.

const ANSI = /\u001b\[[0-9;]*m/g;

/**
 * Canonical URL for deduplication. Share buttons differ only in their query
 * string, so the base URL is checked once rather than once per shared post.
 * @param {string} url
 * @returns {string}
 */
export function getCanonicalUrl(url) {
  try {
    const urlObj = new URL(url);
    const shareServices = [
      'wa.me',
      'facebook.com/sharer.php',
      'x.com/intent',
      'twitter.com/intent',
      'pinterest.com/pin',
      't.me/share'
    ];

    const isShareService = shareServices.some(service => {
      const [serviceHost, ...servicePathParts] = service.split('/');
      const servicePath = servicePathParts.length ? '/' + servicePathParts.join('/') : '';
      const { hostname, pathname } = urlObj;

      const hostnameMatches =
        hostname === serviceHost ||
        hostname.endsWith('.' + serviceHost);

      const pathMatches =
        servicePath === '' ? true : pathname.startsWith(servicePath);

      return hostnameMatches && pathMatches;
    });

    if (isShareService) {
      return urlObj.origin + urlObj.pathname;
    }

    return url;
  } catch {
    return url;
  }
}

/**
 * Extract the external URLs that failed htmltest, with their HTTP status where
 * htmltest reported one.
 *
 * @param {string} output - combined stdout+stderr from htmltest
 * @returns {{failedUrls: string[], statusByUrl: Map<string, number|null>, totalFailures: number, skippedCount: number}}
 *   failedUrls is one representative URL per canonical group. statusByUrl maps
 *   every URL seen to its status, or null when the failure carried no status
 *   (a timeout, DNS or TLS error).
 */
export function parseHtmltestFailures(output) {
  const statusByUrl = new Map();
  const allUrls = [];

  const lines = String(output ?? '').replace(ANSI, '').split('\n');

  for (const line of lines) {
    const match = line.match(FAILURE_LINE);
    if (!match) continue;

    const url = match[1];

    const statusMatch = line.match(/Non-OK status:\s*(\d{3})/);
    const newStatus = statusMatch ? Number(statusMatch[1]) : null;
    const existingStatus = statusByUrl.has(url) ? statusByUrl.get(url) : undefined;

    // First encounter wins, except that a concrete status always replaces a
    // null one — the same URL can fail on one page with a status and on
    // another with a timeout, and the status is the more useful of the two.
    if (!statusByUrl.has(url) || (existingStatus == null && newStatus != null)) {
      statusByUrl.set(url, newStatus);
    }

    allUrls.push(url);
  }

  // Collapse to one representative per canonical URL, preferring a
  // representative that carries a concrete status so the report can show it.
  const canonicalToRepUrl = new Map();

  for (const url of allUrls) {
    const canonical = getCanonicalUrl(url);
    const currentStatus = statusByUrl.get(url);

    if (!canonicalToRepUrl.has(canonical)) {
      canonicalToRepUrl.set(canonical, url);
    } else {
      const existingUrl = canonicalToRepUrl.get(canonical);
      const existingStatus = statusByUrl.get(existingUrl);

      if ((existingStatus == null) && (currentStatus != null)) {
        canonicalToRepUrl.set(canonical, url);
      }
    }
  }

  const failedUrls = [...canonicalToRepUrl.values()];

  return {
    failedUrls,
    statusByUrl,
    totalFailures: allUrls.length,
    skippedCount: allUrls.length - failedUrls.length
  };
}
