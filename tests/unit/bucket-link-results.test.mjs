import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyHtmltestEvidence,
  bucketLinkResults,
  isAuthRequiredDomain,
} from "../../scripts/lib/bucket-link-results.js";
import { parseHtmltestFailures } from "../../scripts/lib/parse-htmltest.js";

// Minimal verifyUrl-shaped results; only the fields bucketing reads.
const reachable = (url, status = 200) => ({ url, status, reachable: true, withheld: false, temporary: false, timedOut: false, success: true });
const withheld = (url, status) => ({ url, status, reachable: false, withheld: true, temporary: false, timedOut: false, success: true });
const serverError = (url, status = 503) => ({ url, status, reachable: false, withheld: false, temporary: true, timedOut: false, success: true });
const timedOut = url => ({ url, error: "page.goto: Timeout 30000ms exceeded.", reachable: false, withheld: false, temporary: true, timedOut: true, success: true });
const brokenResult = (url, status = 404) => ({ url, status, reachable: false, withheld: false, temporary: false, timedOut: false, success: false });

const bucket = (results, statuses = {}, isManualMode = false) =>
  bucketLinkResults({ results, statusByUrl: new Map(Object.entries(statuses)), isManualMode });

const urls = list => list.map(r => r.url);

describe("applyHtmltestEvidence", () => {
  it("demotes a browser timeout to broken when htmltest saw a 404 or 410", () => {
    for (const status of [404, 410]) {
      const r = applyHtmltestEvidence(timedOut("https://a.example/"), status);
      assert.equal(r.success, false, `htmltest ${status}`);
      assert.equal(r.temporary, false, `htmltest ${status}`);
      assert.match(r.error, new RegExp(`htmltest reported ${status}; browser timed out`));
    }
  });

  it("leaves a timeout temporary for any other 4xx: gates, method, htmltest's own timeout", () => {
    for (const status of [400, 401, 403, 405, 407, 408, 421, 425, 429, 451]) {
      const r = applyHtmltestEvidence(timedOut("https://a.example/"), status);
      assert.equal(r.success, true, `htmltest ${status}`);
      assert.equal(r.temporary, true, `htmltest ${status}`);
    }
  });

  it("leaves a timeout temporary when htmltest had no status, a 5xx, or 999", () => {
    for (const status of [null, undefined, 500, 503, 999]) {
      const r = applyHtmltestEvidence(timedOut("https://a.example/"), status);
      assert.equal(r.temporary, true, `htmltest ${status}`);
    }
  });

  it("never touches a result that did not time out", () => {
    const input = serverError("https://a.example/");
    assert.equal(applyHtmltestEvidence(input, 404), input);
  });

  it("does not mutate its input", () => {
    const input = timedOut("https://a.example/");
    applyHtmltestEvidence(input, 404);
    assert.equal(input.success, true);
  });
});

describe("bucketLinkResults", () => {
  it("puts a timeout in its own section and in no 5xx or connection-error section", () => {
    const t = timedOut("https://slow.example/");
    for (const htmltestStatus of [null, 503, 404]) {
      const b = bucket([t], { [t.url]: htmltestStatus });
      assert.deepEqual(urls(b.timedOutResults), [t.url], `htmltest ${htmltestStatus}`);
      assert.deepEqual(b.htmltest5xxTemporaries, [], `htmltest ${htmltestStatus}`);
      assert.deepEqual(b.browserTemporaryOther, [], `htmltest ${htmltestStatus}`);
      assert.deepEqual(b.connectionErrors, [], `htmltest ${htmltestStatus}`);
      assert.deepEqual(b.trulyBroken, [], `htmltest ${htmltestStatus}`);
    }
  });

  it("fails a timeout that htmltest evidence demoted", () => {
    const t = applyHtmltestEvidence(timedOut("https://gone.example/"), 404);
    const b = bucket([t], { [t.url]: 404 });
    assert.deepEqual(urls(b.trulyBroken), [t.url]);
    assert.deepEqual(b.timedOutResults, []);
  });

  it("routes a broken auth-required URL to unverifiable, by redirect target too", () => {
    const direct = brokenResult("https://www.linkedin.com/in/someone");
    const redirected = { ...brokenResult("https://lnkd.in/x"), finalUrl: "https://www.linkedin.com/login" };
    const b = bucket([direct, redirected]);
    assert.deepEqual(urls(b.unverifiable), [direct.url, redirected.url]);
    assert.deepEqual(b.trulyBroken, []);
  });

  it("splits 5xx temporaries by htmltest status", () => {
    const both5xx = serverError("https://a.example/", 502);
    const htmltest404 = serverError("https://b.example/", 503);
    const b = bucket([both5xx, htmltest404], { [both5xx.url]: 500, [htmltest404.url]: 404 });
    assert.deepEqual(urls(b.htmltest5xxTemporaries), [both5xx.url]);
    assert.deepEqual(urls(b.browserTemporaryOther), [htmltest404.url]);
  });

  it("suggests ignore candidates only for reachable URLs with a non-policy htmltest status", () => {
    const softBlock = reachable("https://a.example/");
    const policy403 = reachable("https://b.example/");
    const connError = reachable("https://c.example/");
    const linkedin = reachable("https://www.linkedin.com/in/x");
    const b = bucket([softBlock, policy403, connError, linkedin], {
      [softBlock.url]: 404,
      [policy403.url]: 403,
      [connError.url]: null,
      [linkedin.url]: 404,
    });
    assert.deepEqual(urls(b.ignoreCandidates), [softBlock.url]);
    assert.deepEqual(urls(b.htmltest403s), [policy403.url]);
    assert.deepEqual(urls(b.connectionErrors), [connError.url]);
  });

  it("counts withheld 403/999 and 429 separately and lists 429s from htmltest", () => {
    const w403 = withheld("https://a.example/", 403);
    const w999 = withheld("https://b.example/", 999);
    const w429 = withheld("https://c.example/", 429);
    const b = bucket([w403, w999, w429], { [w403.url]: 403, [w999.url]: 999, [w429.url]: 429 });
    assert.equal(b.withheld403_999Count, 2);
    assert.equal(b.withheld429Count, 1);
    assert.deepEqual(urls(b.htmltest429s), [w429.url]);
    assert.deepEqual(b.browserWithheldOther, []);
  });

  it("skips every htmltest-keyed section in manual mode", () => {
    const b = bucket(
      [reachable("https://a.example/"), serverError("https://b.example/"), withheld("https://c.example/", 429)],
      {},
      true
    );
    for (const key of [
      "ignoreCandidates", "htmltest403s", "htmltest999s", "htmltest5xxTemporaries",
      "browserWithheldOther", "browserTemporaryOther", "connectionErrors", "htmltest429s",
    ]) {
      assert.deepEqual(b[key], [], key);
    }
    assert.equal(b.notBrokenResults.length, 3);
  });
});

describe("parser to bucketing", () => {
  // The path check-links.js takes: parse htmltest output, look up the
  // representative URL's status, apply it to a browser timeout, bucket.
  const run = output => {
    const { failedUrls, statusByUrl } = parseHtmltestFailures(output);
    const results = failedUrls.map(url => applyHtmltestEvidence(timedOut(url), statusByUrl.get(url)));
    return bucket(results, Object.fromEntries(statusByUrl));
  };

  it("fails a timed-out URL when any repeated diagnostic was a 404 or 410, in either order", () => {
    const url = "https://gone.example/x";
    for (const [first, second] of [[403, 404], [404, 403], [503, 410], [410, 503]]) {
      const b = run(
        `  Non-OK status: ${first} --- a/index.html --> ${url}\n` +
        `  Non-OK status: ${second} --- b/index.html --> ${url}\n`
      );
      assert.deepEqual(urls(b.trulyBroken), [url], `${first} then ${second}`);
      assert.deepEqual(b.timedOutResults, [], `${first} then ${second}`);
    }
  });

  it("fails a timed-out share URL when another member of its group saw a 404", () => {
    for (const order of [["403", "404"], ["404", "403"]]) {
      const b = run(order.map(s => `  Non-OK status: ${s} --- ${s}/index.html --> https://wa.me/?text=${s}\n`).join(""));
      assert.equal(b.trulyBroken.length, 1, `order ${order.join(" then ")}`);
    }
  });

  it("keeps a timed-out URL temporary when no diagnostic was a 404 or 410", () => {
    const url = "https://slow.example/x";
    const b = run(
      `  Non-OK status: 403 --- a/index.html --> ${url}\n` +
      `  Non-OK status: 503 --- b/index.html --> ${url}\n`
    );
    assert.deepEqual(urls(b.timedOutResults), [url]);
    assert.deepEqual(b.trulyBroken, []);
  });
});

describe("isAuthRequiredDomain", () => {
  it("matches the domain and its subdomains only", () => {
    assert.equal(isAuthRequiredDomain("https://linkedin.com/x"), true);
    assert.equal(isAuthRequiredDomain("https://www.linkedin.com/x"), true);
    assert.equal(isAuthRequiredDomain("https://notlinkedin.com/x"), false);
    assert.equal(isAuthRequiredDomain("not a url"), false);
  });
});
