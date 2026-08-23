import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractLinks,
  hashLinks,
  diffPost,
  discoverEndpoint,
  parseLinkHeader,
  pageUrlFor,
  classifyFailure,
  attemptLimitFor,
  shouldSkipTarget,
  recordFailure,
  REPROBE_AFTER_MS,
} from "../../scripts/send-webmentions.mjs";

const PAGE = "https://kyle.skrinak.com/posts/example/";

/** Wrap body markup in the page shell the sender expects. */
const page = (articleInner, outsideArticle = "") => `
<!doctype html><html><body>
<header><a href="https://github.com/kyleskrinak" rel="me">GitHub</a></header>
<main id="main-content">
<article id="article">${articleInner}</article>
${outsideArticle}
</main>
</body></html>`;

describe("extractLinks", () => {
  it("returns absolute external links from inside the article", () => {
    const html = page('<a href="https://example.com/a">a</a>');
    assert.deepEqual(extractLinks(html, PAGE), ["https://example.com/a"]);
  });

  it("ignores everything outside #article", () => {
    // The five SOCIALS rel="me" anchors, the footer h-card and the
    // prev/next buttons all live outside the article and are not mentions.
    const html = page(
      '<a href="https://example.com/a">a</a>',
      '<footer><a href="https://x.com/screenack">X</a></footer>',
    );
    assert.deepEqual(extractLinks(html, PAGE), ["https://example.com/a"]);
  });

  it("returns an empty list when there is no article element", () => {
    assert.deepEqual(
      extractLinks(
        '<html><body><a href="https://e.com/">e</a></body></html>',
        PAGE,
      ),
      [],
    );
  });

  it("resolves relative and root-relative hrefs against the page URL", () => {
    const html = page(
      '<a href="/about/">about</a><a href="../other/">other</a>',
    );
    // Both resolve to the source host, so both are dropped as self-links.
    assert.deepEqual(extractLinks(html, PAGE), []);
  });

  it("drops self-links to the source host", () => {
    const html = page(
      '<a href="https://kyle.skrinak.com/posts/other/">mine</a><a href="https://example.com/">theirs</a>',
    );
    assert.deepEqual(extractLinks(html, PAGE), ["https://example.com/"]);
  });

  it("drops non-http protocols", () => {
    const html = page(
      '<a href="mailto:kyle@example.com">mail</a>' +
        '<a href="tel:+15555555555">tel</a>' +
        '<a href="javascript:void(0)">js</a>' +
        '<a href="https://example.com/">ok</a>',
    );
    assert.deepEqual(extractLinks(html, PAGE), ["https://example.com/"]);
  });

  it("collapses fragments to a single target", () => {
    const html = page(
      '<a href="https://example.com/p#one">1</a><a href="https://example.com/p#two">2</a>',
    );
    assert.deepEqual(extractLinks(html, PAGE), ["https://example.com/p"]);
  });

  it("dedupes repeated links to the same target", () => {
    const html = page(
      '<a href="https://example.com/a">1</a><a href="https://example.com/a">2</a>',
    );
    assert.deepEqual(extractLinks(html, PAGE), ["https://example.com/a"]);
  });

  it("skips anchors with an empty href", () => {
    const html = page(
      '<a href="">empty</a><a href="https://example.com/">ok</a>',
    );
    assert.deepEqual(extractLinks(html, PAGE), ["https://example.com/"]);
  });

  it("returns links sorted, independent of document order", () => {
    const forward = page(
      '<a href="https://a.com/">a</a><a href="https://b.com/">b</a>',
    );
    const reverse = page(
      '<a href="https://b.com/">b</a><a href="https://a.com/">a</a>',
    );
    assert.deepEqual(extractLinks(forward, PAGE), extractLinks(reverse, PAGE));
  });
});

describe("hashLinks", () => {
  it("is stable across calls", () => {
    assert.equal(hashLinks(["https://a.com/"]), hashLinks(["https://a.com/"]));
  });

  it("is independent of order", () => {
    assert.equal(
      hashLinks(["https://a.com/", "https://b.com/"]),
      hashLinks(["https://b.com/", "https://a.com/"]),
    );
  });

  it("is independent of duplicates", () => {
    assert.equal(
      hashLinks(["https://a.com/", "https://a.com/"]),
      hashLinks(["https://a.com/"]),
    );
  });

  it("changes when a link is added", () => {
    assert.notEqual(
      hashLinks(["https://a.com/"]),
      hashLinks(["https://a.com/", "https://b.com/"]),
    );
  });

  it("changes when a link is removed", () => {
    assert.notEqual(
      hashLinks(["https://a.com/", "https://b.com/"]),
      hashLinks(["https://b.com/"]),
    );
  });

  it("distinguishes the empty set from a single empty string", () => {
    assert.notEqual(hashLinks([]), hashLinks([""]));
  });
});

describe("diffPost — the idempotence contract", () => {
  it("rebuild with no content change sends nothing", () => {
    const links = ["https://a.com/", "https://b.com/"];
    const entry = { hash: hashLinks(links), sent: links };
    const { unchanged, pending } = diffPost(links, entry);
    assert.equal(unchanged, true);
    assert.deepEqual(pending, []);
  });

  it("editing prose without touching links sends nothing", () => {
    // Prose edits do not reach diffPost at all — the link set is identical,
    // so the hash is identical.
    const links = ["https://a.com/"];
    const before = hashLinks(links);
    const after = hashLinks(links);
    assert.equal(before, after);
    assert.equal(
      diffPost(links, { hash: before, sent: links }).unchanged,
      true,
    );
  });

  it("adding one link to an old post yields exactly that one pair", () => {
    const old = ["https://a.com/"];
    const entry = { hash: hashLinks(old), sent: old };
    const { unchanged, pending } = diffPost(
      [...old, "https://new.com/"],
      entry,
    );
    assert.equal(unchanged, false);
    assert.deepEqual(pending, ["https://new.com/"]);
  });

  it("removing a link sends nothing new", () => {
    const entry = {
      hash: hashLinks(["https://a.com/", "https://b.com/"]),
      sent: ["https://a.com/", "https://b.com/"],
    };
    const { pending } = diffPost(["https://a.com/"], entry);
    assert.deepEqual(pending, []);
  });

  it("re-adding a previously removed link does not re-notify", () => {
    // `sent` is never pruned, so the target is still recorded as delivered.
    const entry = {
      hash: hashLinks(["https://a.com/"]),
      sent: ["https://a.com/", "https://b.com/"],
    };
    const { pending } = diffPost(["https://a.com/", "https://b.com/"], entry);
    assert.deepEqual(pending, []);
  });

  it("a target that failed last run is still pending even when the hash matches", () => {
    const links = ["https://a.com/", "https://down.com/"];
    const entry = { hash: hashLinks(links), sent: ["https://a.com/"] };
    const { unchanged, pending } = diffPost(links, entry);
    assert.equal(
      unchanged,
      false,
      "hash match alone must not suppress a retry",
    );
    assert.deepEqual(pending, ["https://down.com/"]);
  });

  it("treats a missing entry as everything pending", () => {
    const { unchanged, pending } = diffPost(["https://a.com/"], undefined);
    assert.equal(unchanged, false);
    assert.deepEqual(pending, ["https://a.com/"]);
  });

  it("a post with no links is unchanged once recorded", () => {
    assert.equal(
      diffPost([], { hash: hashLinks([]), sent: [] }).unchanged,
      true,
    );
  });
});

describe("parseLinkHeader", () => {
  it("finds a rel=webmention target", () => {
    assert.equal(
      parseLinkHeader('<https://example.com/wm>; rel="webmention"'),
      "https://example.com/wm",
    );
  });

  it("ignores other rel values", () => {
    assert.equal(
      parseLinkHeader('<https://example.com/f>; rel="alternate"'),
      null,
    );
  });

  it("matches webmention among several rel tokens", () => {
    assert.equal(
      parseLinkHeader('<https://example.com/wm>; rel="pingback webmention"'),
      "https://example.com/wm",
    );
  });

  it("handles multiple comma-separated entries", () => {
    assert.equal(
      parseLinkHeader(
        '<https://example.com/a>; rel="alternate", <https://example.com/wm>; rel="webmention"',
      ),
      "https://example.com/wm",
    );
  });

  it("tolerates an unquoted rel value", () => {
    assert.equal(
      parseLinkHeader("<https://example.com/wm>; rel=webmention"),
      "https://example.com/wm",
    );
  });

  it("is case-insensitive on the rel token", () => {
    assert.equal(
      parseLinkHeader('<https://example.com/wm>; rel="WebMention"'),
      "https://example.com/wm",
    );
  });

  it("does not split on a comma inside the URL", () => {
    assert.equal(
      parseLinkHeader('<https://example.com/a,b>; rel="webmention"'),
      "https://example.com/a,b",
    );
  });
});

describe("discoverEndpoint", () => {
  const res = (headerValue, url = "https://example.com/post") => ({
    url,
    headers: {
      get: (name) => (name.toLowerCase() === "link" ? headerValue : null),
    },
  });

  it("prefers the Link header over markup", () => {
    const html =
      '<html><head><link rel="webmention" href="/from-markup"></head><body></body></html>';
    assert.equal(
      discoverEndpoint(
        res('<https://example.com/from-header>; rel="webmention"'),
        html,
      ),
      "https://example.com/from-header",
    );
  });

  it("falls back to a <link> element", () => {
    const html =
      '<html><head><link rel="webmention" href="https://example.com/wm"></head></html>';
    assert.equal(discoverEndpoint(res(null), html), "https://example.com/wm");
  });

  it("accepts an <a> element", () => {
    const html =
      '<html><body><a rel="webmention" href="/wm">wm</a></body></html>';
    assert.equal(discoverEndpoint(res(null), html), "https://example.com/wm");
  });

  it("resolves a relative endpoint against the final URL", () => {
    const html =
      '<html><head><link rel="webmention" href="../wm"></head></html>';
    assert.equal(
      discoverEndpoint(res(null, "https://example.com/blog/post"), html),
      "https://example.com/wm",
    );
  });

  it("treats an empty href as the page itself", () => {
    const html = '<html><head><link rel="webmention" href=""></head></html>';
    assert.equal(discoverEndpoint(res(null), html), "https://example.com/post");
  });

  it("matches webmention among several rel tokens, case-insensitively", () => {
    const html =
      '<html><head><link rel="Pingback WebMention" href="/wm"></head></html>';
    assert.equal(discoverEndpoint(res(null), html), "https://example.com/wm");
  });

  it("does not match a rel that merely contains the word", () => {
    const html =
      '<html><head><link rel="not-webmention-really" href="/wm"></head></html>';
    assert.equal(discoverEndpoint(res(null), html), null);
  });

  it("returns null when nothing is advertised", () => {
    assert.equal(
      discoverEndpoint(res(null), "<html><body>nothing</body></html>"),
      null,
    );
  });

  it("takes the first advertised endpoint in document order", () => {
    const html =
      '<html><head><link rel="webmention" href="/first"></head><body><a rel="webmention" href="/second">x</a></body></html>';
    assert.equal(
      discoverEndpoint(res(null), html),
      "https://example.com/first",
    );
  });
});

describe("pageUrlFor", () => {
  it("maps a built post path to its canonical URL", () => {
    assert.equal(
      pageUrlFor("posts/example/index.html", "https://kyle.skrinak.com/"),
      "https://kyle.skrinak.com/posts/example/",
    );
  });

  it("tolerates a site URL without a trailing slash", () => {
    assert.equal(
      pageUrlFor("posts/example/index.html", "https://kyle.skrinak.com"),
      "https://kyle.skrinak.com/posts/example/",
    );
  });

  it("preserves nested post paths", () => {
    assert.equal(
      pageUrlFor("posts/2026/example/index.html", "https://kyle.skrinak.com/"),
      "https://kyle.skrinak.com/posts/2026/example/",
    );
  });
});

describe("classifyFailure", () => {
  it("treats a 403 as a refusal", () => {
    assert.equal(classifyFailure({ status: 403 }), "refused");
  });

  it("treats 401, 405, 410 and 451 as refusals", () => {
    for (const status of [401, 405, 410, 451]) {
      assert.equal(classifyFailure({ status }), "refused", `status ${status}`);
    }
  });

  it("treats a 404 as a refusal — the target page is gone", () => {
    assert.equal(classifyFailure({ status: 404 }), "refused");
  });

  it("treats a 503 as transient", () => {
    assert.equal(classifyFailure({ status: 503 }), "transient");
  });

  it("treats a 429 as transient — rate limiting is not a refusal", () => {
    assert.equal(classifyFailure({ status: 429 }), "transient");
  });

  it("treats a missing status as transient", () => {
    // Timeouts, DNS failures and connection resets produce no status at all.
    assert.equal(classifyFailure({ reason: "fetch failed" }), "transient");
    assert.equal(classifyFailure(undefined), "transient");
  });
});

describe("attemptLimitFor", () => {
  it("is stricter for refusals than for transient failures", () => {
    assert.ok(attemptLimitFor("refused") < attemptLimitFor("transient"));
  });

  it("is generous enough for transient failures to survive an outage", () => {
    // A site down for a week of deploys must still be picked up on return.
    assert.ok(attemptLimitFor("transient") >= 10);
  });

  it("gives up on a missing endpoint after a single observation", () => {
    // The page was fetched and parsed; refetching it next deploy learns
    // nothing. One is the point — the 30-day re-probe does the rest.
    assert.equal(attemptLimitFor("no-endpoint"), 1);
  });

  it("is strictest for a missing endpoint", () => {
    assert.ok(attemptLimitFor("no-endpoint") < attemptLimitFor("refused"));
  });
});

describe("no-endpoint targets are reconsidered, not written off", () => {
  const now = Date.parse("2026-08-23T00:00:00.000Z");

  it("stops probing immediately after one observation", () => {
    const record = recordFailure(undefined, "no-endpoint", now);
    assert.equal(record.failures, 1);
    assert.equal(shouldSkipTarget(record, now), true);
  });

  it("probes again once the re-probe interval has passed", () => {
    // The regression this guards: a target recorded in `sent` would never be
    // reconsidered, because `sent` is never pruned.
    const record = recordFailure(undefined, "no-endpoint", now);
    assert.equal(shouldSkipTarget(record, now + REPROBE_AFTER_MS + 1), false);
  });

  it("rests another full interval when the re-probe still finds nothing", () => {
    const first = recordFailure(undefined, "no-endpoint", now);
    const later = now + REPROBE_AFTER_MS + 1;
    const second = recordFailure(first, "no-endpoint", later);
    assert.equal(second.failures, 2);
    assert.equal(shouldSkipTarget(second, later), true);
    assert.equal(shouldSkipTarget(second, later + REPROBE_AFTER_MS + 1), false);
  });

  it("keeps a target pending so a later endpoint still gets delivered", () => {
    // diffPost drives what gets probed. A no-endpoint target must stay in
    // `pending`, which is exactly what routing it away from `sent` achieves.
    const links = ["https://example.com/a/"];
    const { pending, unchanged } = diffPost(links, { hash: "x", sent: [] });
    assert.deepEqual(pending, links);
    assert.equal(unchanged, false);
  });
});

describe("shouldSkipTarget", () => {
  const now = Date.parse("2026-08-23T00:00:00.000Z");
  const record = (failures, kind, agoMs = 0) => ({
    failures,
    kind,
    lastAttempt: new Date(now - agoMs).toISOString(),
  });

  it("does not skip a target with no history", () => {
    assert.equal(shouldSkipTarget(undefined, now), false);
  });

  it("does not skip below the limit", () => {
    const under = attemptLimitFor("refused") - 1;
    assert.equal(shouldSkipTarget(record(under, "refused"), now), false);
  });

  it("skips a refusing target once it hits the refusal limit", () => {
    const at = attemptLimitFor("refused");
    assert.equal(shouldSkipTarget(record(at, "refused"), now), true);
  });

  it("still retries a transient failure at the refusal limit", () => {
    // The whole point of two limits: a 503 three times over is not a 403
    // three times over, and must not be given up on as quickly.
    const at = attemptLimitFor("refused");
    assert.equal(shouldSkipTarget(record(at, "transient"), now), false);
  });

  it("skips a transient target once it hits the transient limit", () => {
    const at = attemptLimitFor("transient");
    assert.equal(shouldSkipTarget(record(at, "transient"), now), true);
  });

  it("reconsiders a given-up target after the re-probe interval", () => {
    const gaveUp = record(99, "refused", REPROBE_AFTER_MS + 1);
    assert.equal(shouldSkipTarget(gaveUp, now), false);
  });

  it("keeps skipping just before the re-probe interval elapses", () => {
    const gaveUp = record(99, "refused", REPROBE_AFTER_MS - 1000);
    assert.equal(shouldSkipTarget(gaveUp, now), true);
  });

  it("retries when the timestamp is missing or corrupt", () => {
    // Fail towards trying: a wasted request beats a mention never sent.
    assert.equal(
      shouldSkipTarget({ failures: 99, kind: "refused" }, now),
      false,
    );
    assert.equal(
      shouldSkipTarget(
        { failures: 99, kind: "refused", lastAttempt: "not a date" },
        now,
      ),
      false,
    );
  });
});

describe("recordFailure", () => {
  const now = Date.parse("2026-08-23T00:00:00.000Z");

  it("starts a count at one", () => {
    const r = recordFailure(undefined, "transient", now);
    assert.equal(r.failures, 1);
    assert.equal(r.kind, "transient");
    assert.equal(r.lastAttempt, "2026-08-23T00:00:00.000Z");
  });

  it("increments an existing count", () => {
    const r = recordFailure(
      { failures: 4, kind: "transient" },
      "transient",
      now,
    );
    assert.equal(r.failures, 5);
  });

  it("does not restart the count when the failure kind changes", () => {
    // A target alternating 503 and 403 would otherwise evade every limit.
    const r = recordFailure({ failures: 9, kind: "transient" }, "refused", now);
    assert.equal(r.failures, 10);
    assert.equal(r.kind, "refused");
  });

  it("applies the new kind's limit after a change of kind", () => {
    const r = recordFailure({ failures: 2, kind: "transient" }, "refused", now);
    assert.equal(shouldSkipTarget(r, now), true, "3 failures, now refusing");
  });

  it("refreshes lastAttempt so a failed re-probe rests again", () => {
    const stale = {
      failures: 99,
      kind: "refused",
      lastAttempt: new Date(now - REPROBE_AFTER_MS - 1).toISOString(),
    };
    assert.equal(
      shouldSkipTarget(stale, now),
      false,
      "due for reconsideration",
    );
    const after = recordFailure(stale, "refused", now);
    assert.equal(shouldSkipTarget(after, now), true, "rests another interval");
  });
});

describe("failure counter — reset on success", () => {
  // main() deletes state.targets[target] on a successful send. These assert
  // the contract that deletion satisfies: no record means no skipping.
  const now = Date.parse("2026-08-23T00:00:00.000Z");

  it("a cleared record makes the target eligible again", () => {
    const targets = {
      "https://example.com/": {
        failures: 99,
        kind: "refused",
        lastAttempt: new Date(now).toISOString(),
      },
    };
    assert.equal(shouldSkipTarget(targets["https://example.com/"], now), true);
    delete targets["https://example.com/"];
    assert.equal(shouldSkipTarget(targets["https://example.com/"], now), false);
  });

  it("counting restarts from one after a reset", () => {
    const r = recordFailure(undefined, "transient", now);
    assert.equal(r.failures, 1);
    assert.equal(shouldSkipTarget(r, now), false);
  });
});
