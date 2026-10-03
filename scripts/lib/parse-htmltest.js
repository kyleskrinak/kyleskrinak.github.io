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
//   alt attribute missing --- posts/x/index.html --> https://cdn.example.com/i.png
//
// The target is a single whitespace-free token, so capturing it whole avoids
// having to guess where it ends — an earlier version trimmed trailing
// punctuation and would have mangled a legitimate URL ending in ')', such as a
// Wikipedia disambiguation link.
const FAILURE_LINE = /^\s*(.*?)\s+---\s+\S+\s+-->\s*(\S*)/;

const ANSI = /\u001b\[[0-9;]*m/g;

// Structure alone cannot say whether a failure is a network outcome: the fourth
// example above is a missing alt attribute on an externally hosted image, and it
// has exactly the same shape as a network failure with an http(s) target.
// Forwarding it to tier 2 would launder an accessibility defect into a pass,
// because the image answers 200 and tier 2 only reports on reachability.
//
// So the message decides the route, and only these shapes — an HTTP status, a Go
// transport error from htmltest's URL check, or htmltest's own timeout — mean
// "the network was consulted".
const NETWORK_MESSAGES = [
  /^Non-OK status:\s*\d{3}\b/,
  /^(?:Get|Head|Post)\s+"[^"]*":/,
  /request exceeded our ExternalTimeout/
];

/**
 * Anything whose message is not recognisably a network outcome is treated as a
 * markup, accessibility or internal-reference failure and is fatal.
 *
 * This direction is deliberate. Defaulting an unrecognised message to "network"
 * would let a new htmltest check pass the gate silently; defaulting it to fatal
 * can only cause a loud, reported failure that names the offending line. Issue
 * #391's real damage was silence — a URL that reached no bucket failed the gate
 * with nothing in the report to explain it — so the fail-closed direction is
 * what keeps that from recurring, not the matching itself.
 */
function isNetworkMessage(message) {
  return NETWORK_MESSAGES.some(pattern => pattern.test(message));
}

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
 * Split htmltest's failures into external URLs for browser verification and
 * failures that must fail the build on their own.
 *
 * @param {string} output - combined stdout+stderr from htmltest
 * @returns {{failedUrls: string[], statusByUrl: Map<string, number|null>, totalFailures: number, skippedCount: number, nonNetworkFailures: string[]}}
 *   failedUrls is one representative URL per canonical group. statusByUrl maps
 *   every URL seen to its status, or null when the failure carried no status (a
 *   timeout, DNS or TLS error). nonNetworkFailures holds the verbatim lines that
 *   tier 2 cannot adjudicate — markup, accessibility and internal references —
 *   which the caller must treat as fatal regardless of what tier 2 concludes.
 */
export function parseHtmltestFailures(output) {
  const statusByUrl = new Map();
  const allUrls = [];
  const nonNetworkFailures = [];

  const lines = String(output ?? '').replace(ANSI, '').split('\n');

  for (const line of lines) {
    const match = line.match(FAILURE_LINE);
    if (!match) continue;

    const message = match[1].trim();
    const url = match[2];

    const isExternal = /^https?:\/\//.test(url);

    if (!isExternal || !isNetworkMessage(message)) {
      nonNetworkFailures.push(line.trim());
      continue;
    }

    const statusMatch = message.match(/Non-OK status:\s*(\d{3})/);
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
    skippedCount: allUrls.length - failedUrls.length,
    nonNetworkFailures
  };
}
