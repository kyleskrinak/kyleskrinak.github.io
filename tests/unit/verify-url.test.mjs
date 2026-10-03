import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { verifyUrl } from "../../scripts/lib/verify-url.js";

/**
 * verifyUrl only touches page.goto(), page.content() and page.url(), so a stub
 * covers the classification logic without launching Chromium. That keeps these
 * tests runnable in unit-tests.yml, which does not install Playwright browsers,
 * and lets us exercise paths a real browser makes hard to reach on demand —
 * a null response, a thrown navigation, a content() call that fails.
 */
function makePage({
  status,
  headers = {},
  body = "",
  finalUrl,
  gotoError,
  contentError,
  nullResponse = false,
} = {}) {
  let current = "about:blank";
  return {
    async goto(url) {
      if (gotoError) {
        // A real browser leaves page.url() at about:blank when navigation fails
        // before anything commits, which is the case verifyUrl's fallback exists
        // for. Only an explicit finalUrl models a failure part-way through a
        // redirect chain, where the last URL navigated to does survive. Assigning
        // `current` unconditionally here would make the fallback test pass
        // through the wrong branch.
        if (finalUrl) current = finalUrl;
        throw new Error(gotoError);
      }
      current = finalUrl ?? url;
      if (nullResponse) return null;
      return {
        status: () => status,
        ok: () => typeof status === "number" && status >= 200 && status <= 299,
        headers: () => headers,
      };
    },
    async content() {
      if (contentError) throw new Error(contentError);
      return body;
    },
    url: () => current,
  };
}

const bucketOf = r =>
  r.reachable ? "reachable" : r.withheld ? "withheld" : r.temporary ? "temporary" : "broken";

describe("verifyUrl classification", () => {
  it("treats 2xx as reachable", async () => {
    for (const status of [200, 201, 204, 299]) {
      const r = await verifyUrl(makePage({ status }), "https://example.com/");
      assert.equal(bucketOf(r), "reachable", `status ${status}`);
      assert.equal(r.success, true);
    }
  });

  // The issue #391 regression: GitHub load-sheds against CI runner IPs with a
  // bare 503 carrying no maintenance text. That must not read as link rot.
  it("treats every 5xx as temporary, with or without maintenance markers", async () => {
    for (const status of [500, 501, 502, 503, 504, 599]) {
      const r = await verifyUrl(makePage({ status }), "https://example.com/");
      assert.equal(bucketOf(r), "temporary", `status ${status}`);
      assert.equal(r.success, true, `status ${status} should not fail the gate`);
      assert.deepEqual(r.maintenanceSignals, [], `status ${status} has no markers`);
    }
  });

  it("records maintenance markers on a 503 that declares one", async () => {
    const r = await verifyUrl(
      makePage({
        status: 503,
        body: "<html><body>Down for SCHEDULED MAINTENANCE</body></html>",
        headers: { "retry-after": "120" },
      }),
      "https://example.com/"
    );
    assert.equal(bucketOf(r), "temporary");
    assert.deepEqual(r.maintenanceSignals, ["maintenance page content", "Retry-After: 120"]);
  });

  it("matches maintenance markers case-insensitively", async () => {
    for (const marker of ["Scheduled Maintenance", "UNDER MAINTENANCE", "Maintenance Mode"]) {
      const r = await verifyUrl(
        makePage({ status: 503, body: `<p>${marker}</p>` }),
        "https://example.com/"
      );
      assert.deepEqual(r.maintenanceSignals, ["maintenance page content"], marker);
    }
  });

  it("omits Retry-After when no maintenance content corroborates it", async () => {
    // Retry-After alone is not a maintenance signal: servers send it for
    // ordinary overload and for abuse mitigation too.
    const r = await verifyUrl(
      makePage({ status: 503, body: "<p>Service Unavailable</p>", headers: { "retry-after": "30" } }),
      "https://example.com/"
    );
    assert.equal(bucketOf(r), "temporary");
    assert.deepEqual(r.maintenanceSignals, []);
    assert.equal(r.retryAfter, "30", "still reported as a field");
  });

  it("stays temporary when page.content() throws on a 503", async () => {
    // A detached frame or raced navigation must not demote a 5xx to broken.
    const r = await verifyUrl(
      makePage({ status: 503, contentError: "frame was detached" }),
      "https://example.com/"
    );
    assert.equal(bucketOf(r), "temporary");
    assert.equal(r.success, true);
    assert.deepEqual(r.maintenanceSignals, []);
  });

  it("treats 403, 429 and 999 as withheld", async () => {
    for (const status of [403, 429, 999]) {
      const r = await verifyUrl(makePage({ status }), "https://example.com/");
      assert.equal(bucketOf(r), "withheld", `status ${status}`);
      assert.equal(r.success, true);
    }
  });

  it("treats 4xx other than 403/429 as broken — link rot still fails", async () => {
    for (const status of [400, 404, 410, 451]) {
      const r = await verifyUrl(makePage({ status }), "https://example.com/gone");
      assert.equal(bucketOf(r), "broken", `status ${status}`);
      assert.equal(r.success, false, `status ${status} must fail the gate`);
    }
  });

  it("treats a 3xx that never resolves as broken", async () => {
    // response.ok() is false for a bare 3xx; Playwright follows redirects, so a
    // 3xx surfacing here means the chain did not end at a 2xx.
    const r = await verifyUrl(makePage({ status: 304 }), "https://example.com/");
    assert.equal(bucketOf(r), "broken");
  });

  it("treats a null response as broken rather than a 5xx", async () => {
    const r = await verifyUrl(makePage({ nullResponse: true }), "https://example.com/");
    assert.equal(r.status, "NO_RESPONSE");
    assert.equal(bucketOf(r), "broken");
    assert.equal(r.success, false);
  });
});

describe("verifyUrl redirect and error reporting", () => {
  it("reports the final URL and sets redirected when it differs", async () => {
    const r = await verifyUrl(
      makePage({ status: 200, finalUrl: "https://example.com/moved" }),
      "https://example.com/"
    );
    assert.equal(r.finalUrl, "https://example.com/moved");
    assert.equal(r.redirected, true);
  });

  it("does not set redirected when the URL is unchanged", async () => {
    const r = await verifyUrl(makePage({ status: 200 }), "https://example.com/");
    assert.equal(r.redirected, false);
  });

  it("returns the error message and keeps every bucket false when goto throws", async () => {
    const r = await verifyUrl(
      makePage({ gotoError: "net::ERR_CONNECTION_REFUSED" }),
      "https://example.com/"
    );
    assert.equal(r.error, "net::ERR_CONNECTION_REFUSED");
    assert.equal(r.reachable, false);
    assert.equal(r.withheld, false);
    assert.equal(r.temporary, false);
    assert.equal(r.success, false);
    assert.equal(r.status, undefined, "no status to report");
  });

  it("falls back to the original URL when goto throws before navigating", async () => {
    // The stub leaves page.url() at about:blank here, so this genuinely
    // exercises verify-url's fallback rather than reading back a URL the stub
    // already navigated to.
    const page = makePage({ gotoError: "boom" });
    assert.equal(page.url(), "about:blank", "precondition: never navigated");
    const r = await verifyUrl(page, "https://example.com/x");
    assert.equal(r.finalUrl, "https://example.com/x");
    assert.equal(r.redirected, false, "about:blank must not count as a redirect");
  });

  it("keeps the redirect destination when goto throws mid-redirect", async () => {
    // Bucketing for auth-required domains depends on the effective URL, so the
    // last URL navigated to has to survive the throw.
    const page = makePage({ gotoError: "boom", finalUrl: "https://www.linkedin.com/login" });
    const r = await verifyUrl(page, "https://www.linkedin.com/in/someone");
    assert.equal(r.finalUrl, "https://www.linkedin.com/login");
    assert.equal(r.redirected, true);
  });
});
