import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseHtmltestFailures, getCanonicalUrl } from "../../scripts/lib/parse-htmltest.js";

/**
 * The fixtures below are real htmltest 0.17.0 output lines, captured by running
 * htmltest against a fixture site with ExternalTimeout: 2 and links to a
 * blackholed IP, an NXDOMAIN host and expired.badssl.com. Keeping them verbatim
 * is the point: this parser's job is to match what htmltest actually prints.
 */
const LINE = {
  status403:
    "  Non-OK status: 403 --- about/index.html --> https://www.npmjs.com/",
  status404:
    "  Non-OK status: 404 --- posts/x/index.html --> https://example.com/gone",
  timeout:
    "  request exceeded our ExternalTimeout --- index.html --> http://10.255.255.1/hangs",
  dns:
    '  Get "http://nonexistent-host-xyzzy-12345.invalid/x": dial tcp: lookup nonexistent-host-xyzzy-12345.invalid: no such host --- index.html --> http://nonexistent-host-xyzzy-12345.invalid/x',
  tls:
    '  Get "https://expired.badssl.com/": tls: failed to verify certificate: x509: certificate has expired or is not yet valid: “*.badssl.com” certificate is expired --- index.html --> https://expired.badssl.com/',
  altEmpty:
    "  alt text empty --- posts/x/index.html --> favicon-96x96.png",
  srcMissing:
    "  src attribute missing --- posts/x/index.html --> ",
  internalMissing:
    "  target does not exist --- about/index.html --> /missing/page/",
  // Same line shape as a network failure, but an accessibility defect: the CDN
  // answers 200 while the alt attribute is still missing.
  altMissingExternal:
    "  alt attribute missing --- posts/x/index.html --> https://cdn.example.com/image.png",
  header: "htmltest started at 08:52:53 on dist",
  rule: "========================================================================",
  footer: "3 errors in 1 documents",
};

const outputOf = (...lines) => lines.join("\n") + "\n";

describe("parseHtmltestFailures — which lines yield URLs", () => {
  // The issue #391 gap: a timeout names no scheme in its message, so a filter
  // built on message substrings dropped it and the URL reached no bucket at
  // all — failing the gate without ever being named in the report.
  it("extracts the URL from an ExternalTimeout failure", () => {
    const { failedUrls, statusByUrl } = parseHtmltestFailures(outputOf(LINE.timeout));
    assert.deepEqual(failedUrls, ["http://10.255.255.1/hangs"]);
    assert.equal(statusByUrl.get("http://10.255.255.1/hangs"), null, "no status in a timeout");
  });

  it("extracts URLs from status, DNS and TLS failures", () => {
    const { failedUrls } = parseHtmltestFailures(
      outputOf(LINE.status403, LINE.dns, LINE.tls)
    );
    assert.deepEqual(failedUrls, [
      "https://www.npmjs.com/",
      "http://nonexistent-host-xyzzy-12345.invalid/x",
      "https://expired.badssl.com/",
    ]);
  });

  it("takes the target after --> rather than a URL quoted in the message", () => {
    // The DNS and TLS lines name the URL twice; the target is authoritative.
    const { failedUrls } = parseHtmltestFailures(outputOf(LINE.tls));
    assert.deepEqual(failedUrls, ["https://expired.badssl.com/"]);
  });

  it("routes failures whose target is not an http(s) URL to the fatal bucket", () => {
    const { failedUrls, totalFailures, nonNetworkFailures } = parseHtmltestFailures(
      outputOf(LINE.altEmpty, LINE.srcMissing, LINE.internalMissing)
    );
    assert.deepEqual(failedUrls, [], "nothing for the browser to verify");
    assert.equal(totalFailures, 0);
    assert.equal(nonNetworkFailures.length, 3, "and none of them silently dropped");
  });

  it("ignores header, rule and footer lines", () => {
    const { failedUrls } = parseHtmltestFailures(
      outputOf(LINE.header, LINE.rule, LINE.footer)
    );
    assert.deepEqual(failedUrls, []);
  });

  it("strips ANSI colour codes", () => {
    // htmltest colours its output; the reset from one line leads the next.
    const coloured = `\u001b[31m${LINE.status403}\n\u001b[0m\u001b[31m${LINE.status404}\n\u001b[0m`;
    const { failedUrls } = parseHtmltestFailures(coloured);
    assert.deepEqual(failedUrls, ["https://www.npmjs.com/", "https://example.com/gone"]);
  });

  it("handles empty and nullish input without throwing", () => {
    for (const input of ["", null, undefined]) {
      const { failedUrls, totalFailures, skippedCount } = parseHtmltestFailures(input);
      assert.deepEqual(failedUrls, []);
      assert.equal(totalFailures, 0);
      assert.equal(skippedCount, 0);
    }
  });
});

describe("parseHtmltestFailures — diagnostic kind decides the route", () => {
  // A markup failure on an externally hosted image has the same line shape as a
  // network failure. Forwarding it to tier 2 would launder it into a pass: the
  // image answers 200, so it lands in `reachable` and nothing fails.
  it("does not forward a markup failure that happens to have a URL target", () => {
    const { failedUrls, nonNetworkFailures } = parseHtmltestFailures(
      outputOf(LINE.altMissingExternal)
    );
    assert.deepEqual(failedUrls, [], "the browser cannot excuse a missing alt");
    assert.deepEqual(nonNetworkFailures, [
      "alt attribute missing --- posts/x/index.html --> https://cdn.example.com/image.png",
    ]);
  });

  it("separates network and non-network failures in one run", () => {
    const { failedUrls, nonNetworkFailures } = parseHtmltestFailures(
      outputOf(LINE.status403, LINE.altMissingExternal, LINE.timeout, LINE.internalMissing)
    );
    assert.deepEqual(failedUrls, ["https://www.npmjs.com/", "http://10.255.255.1/hangs"]);
    assert.equal(nonNetworkFailures.length, 2);
  });

  it("treats an unrecognised message as fatal rather than forwarding it", () => {
    // Fail closed: a new htmltest check must not be able to reach tier 2 and be
    // excused by a 200. An unknown message produces a loud, named failure.
    const { failedUrls, nonNetworkFailures } = parseHtmltestFailures(
      outputOf("  some future htmltest check --- a/index.html --> https://example.com/x")
    );
    assert.deepEqual(failedUrls, []);
    assert.equal(nonNetworkFailures.length, 1);
  });

  it("recognises Head and Post transport errors as network failures", () => {
    const { failedUrls, nonNetworkFailures } = parseHtmltestFailures(
      outputOf(
        '  Head "https://a.example/x": EOF --- i.html --> https://a.example/x',
        '  Post "https://b.example/y": context deadline exceeded --- i.html --> https://b.example/y'
      )
    );
    assert.deepEqual(failedUrls, ["https://a.example/x", "https://b.example/y"]);
    assert.deepEqual(nonNetworkFailures, []);
  });

  it("keeps a URL ending in a parenthesis intact", () => {
    // An earlier version trimmed trailing punctuation and would have requested
    // the wrong URL for a Wikipedia disambiguation link.
    const url = "https://en.wikipedia.org/wiki/Bank_(topography)";
    const { failedUrls } = parseHtmltestFailures(
      outputOf(`  Non-OK status: 404 --- a/index.html --> ${url}`)
    );
    assert.deepEqual(failedUrls, [url]);
  });
});

describe("parseHtmltestFailures — status capture", () => {
  it("records the HTTP status when htmltest reports one", () => {
    const { statusByUrl } = parseHtmltestFailures(outputOf(LINE.status403, LINE.status404));
    assert.equal(statusByUrl.get("https://www.npmjs.com/"), 403);
    assert.equal(statusByUrl.get("https://example.com/gone"), 404);
  });

  it("records null when the failure carried no status", () => {
    const { statusByUrl } = parseHtmltestFailures(outputOf(LINE.dns));
    assert.equal(statusByUrl.get("http://nonexistent-host-xyzzy-12345.invalid/x"), null);
  });

  it("lets a concrete status replace a null one for the same URL", () => {
    // The same URL can time out on one page and return a status on another.
    const url = "https://flaky.example.com/x";
    const output = outputOf(
      `  request exceeded our ExternalTimeout --- a/index.html --> ${url}`,
      `  Non-OK status: 503 --- b/index.html --> ${url}`
    );
    assert.equal(parseHtmltestFailures(output).statusByUrl.get(url), 503);
  });

  it("does not let a null overwrite a status already recorded", () => {
    const url = "https://flaky.example.com/x";
    const output = outputOf(
      `  Non-OK status: 503 --- b/index.html --> ${url}`,
      `  request exceeded our ExternalTimeout --- a/index.html --> ${url}`
    );
    assert.equal(parseHtmltestFailures(output).statusByUrl.get(url), 503);
  });

  it("keeps the first status when a URL fails twice with different ones", () => {
    const url = "https://flaky.example.com/x";
    const output = outputOf(
      `  Non-OK status: 403 --- a/index.html --> ${url}`,
      `  Non-OK status: 500 --- b/index.html --> ${url}`
    );
    assert.equal(parseHtmltestFailures(output).statusByUrl.get(url), 403);
  });
});

describe("parseHtmltestFailures — deduplication", () => {
  it("counts every occurrence in totalFailures but reports each URL once", () => {
    const output = outputOf(LINE.status403, LINE.status403, LINE.status403);
    const { failedUrls, totalFailures, skippedCount } = parseHtmltestFailures(output);
    assert.deepEqual(failedUrls, ["https://www.npmjs.com/"]);
    assert.equal(totalFailures, 3);
    assert.equal(skippedCount, 2);
  });

  it("collapses share URLs that differ only by query string", () => {
    const output = outputOf(
      "  Non-OK status: 403 --- a/index.html --> https://wa.me/?text=post-one",
      "  Non-OK status: 403 --- b/index.html --> https://wa.me/?text=post-two"
    );
    const { failedUrls, skippedCount } = parseHtmltestFailures(output);
    assert.equal(failedUrls.length, 1, "one representative for the share service");
    assert.equal(skippedCount, 1);
  });

  it("prefers a representative that carries a concrete status", () => {
    const output = outputOf(
      "  request exceeded our ExternalTimeout --- a/index.html --> https://wa.me/?text=one",
      "  Non-OK status: 403 --- b/index.html --> https://wa.me/?text=two"
    );
    const { failedUrls, statusByUrl } = parseHtmltestFailures(output);
    assert.equal(failedUrls.length, 1);
    assert.equal(statusByUrl.get(failedUrls[0]), 403, "the one with a status represents the group");
  });

  it("keeps distinct non-share URLs separate even on the same host", () => {
    const output = outputOf(
      "  Non-OK status: 404 --- a/index.html --> https://example.com/one",
      "  Non-OK status: 404 --- b/index.html --> https://example.com/two"
    );
    assert.equal(parseHtmltestFailures(output).failedUrls.length, 2);
  });
});

describe("getCanonicalUrl", () => {
  it("strips the query string from known share services", () => {
    assert.equal(getCanonicalUrl("https://wa.me/?text=hello"), "https://wa.me/");
    assert.equal(
      getCanonicalUrl("https://twitter.com/intent/tweet?url=x"),
      "https://twitter.com/intent/tweet"
    );
    assert.equal(
      getCanonicalUrl("https://www.facebook.com/sharer.php?u=x"),
      "https://www.facebook.com/sharer.php",
      "subdomains of a share host count"
    );
  });

  it("leaves ordinary URLs untouched, query string and all", () => {
    const url = "https://example.com/search?q=astro&page=2";
    assert.equal(getCanonicalUrl(url), url);
  });

  it("does not treat a different path on a share host as a share URL", () => {
    const url = "https://twitter.com/someuser?ref=x";
    assert.equal(getCanonicalUrl(url), url, "only /intent paths are share links");
  });

  it("returns unparseable input unchanged", () => {
    assert.equal(getCanonicalUrl("not a url"), "not a url");
  });
});
