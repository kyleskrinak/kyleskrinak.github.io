import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  extractLinks,
  hashLinks,
  diffPost,
  discoverEndpoint,
  parseLinkHeader,
  parseArgs,
  guardedFetch,
  findPostPages,
  MAX_REDIRECTS,
  pageUrlFor,
  classifyFailure,
  attemptLimitFor,
  isBlockedHost,
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

describe("isBlockedHost", () => {
  // The contract is URL.hostname, so obfuscated literals are normalised by the
  // URL parser before the predicate sees them. Route them through it here too.
  const hostOf = (url) => new URL(url).hostname;

  it("blocks loopback in every form the URL parser produces", () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://127.1/",
      "http://0x7f000001/",
      "http://2130706433/",
      "http://017700000001/",
      "http://[::1]/",
      "http://[::ffff:127.0.0.1]/",
    ]) {
      assert.equal(isBlockedHost(hostOf(url)), true, url);
    }
  });

  it("blocks the cloud metadata address", () => {
    // The reason this check exists at all.
    assert.equal(isBlockedHost("169.254.169.254"), true);
    assert.equal(isBlockedHost("metadata.google.internal"), true);
  });

  it("blocks private and CGNAT ranges", () => {
    for (const host of [
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "255.255.255.255",
    ]) {
      assert.equal(isBlockedHost(host), true, host);
    }
  });

  it("does not over-block neighbouring public ranges", () => {
    // 172.15/16 and 172.32/16 are public; only 172.16/12 is private.
    for (const host of [
      "172.15.0.1",
      "172.32.0.1",
      "11.0.0.1",
      "192.169.1.1",
      "100.128.0.1",
      "8.8.8.8",
      "example.com",
      "localhost.example.com",
    ]) {
      assert.equal(isBlockedHost(host), false, host);
    }
  });

  it("blocks IPv6 unique-local and link-local", () => {
    for (const host of ["[fc00::1]", "[fd12:3456::1]", "[fe80::1]", "[::]"]) {
      assert.equal(isBlockedHost(host), true, host);
    }
    assert.equal(isBlockedHost("[2606:4700::1111]"), false);
  });

  it("blocks reserved local suffixes and bare localhost", () => {
    for (const host of [
      "localhost",
      "LOCALHOST",
      "localhost.",
      "foo.localhost",
      "printer.local",
      "thing.home.arpa",
    ]) {
      assert.equal(isBlockedHost(host), true, host);
    }
  });

  it("fails closed on an empty or unparseable host", () => {
    assert.equal(isBlockedHost(""), true);
    assert.equal(isBlockedHost(undefined), true);
    assert.equal(isBlockedHost("[garbage::::]"), true);
  });
});

describe("blocked hosts are never requested", () => {
  it("drops them at extraction", () => {
    const html = page(`
      <a href="http://169.254.169.254/latest/meta-data/">metadata</a>
      <a href="http://0x7f000001:8080/admin">obfuscated loopback</a>
      <a href="http://[::ffff:127.0.0.1]/">mapped loopback</a>
      <a href="https://example.com/real/">a real target</a>
    `);
    assert.deepEqual(extractLinks(html, PAGE), ["https://example.com/real/"]);
  });

  it("treats a blocked host as a refusal, not a transient failure", () => {
    // Permanent by nature: re-probing a link-local address ten times is
    // pointless, and the record should stop it after the refusal limit.
    assert.equal(classifyFailure({ kind: "refused" }), "refused");
  });

  it("still infers the kind from status when none is given", () => {
    assert.equal(classifyFailure({ status: 503 }), "transient");
    assert.equal(classifyFailure({ status: 403 }), "refused");
  });
});

describe("parseArgs", () => {
  it("supplies the documented defaults", () => {
    assert.deepEqual(parseArgs([]), {
      dist: "dist",
      state: ".webmention-state/sent.json",
      dryRun: false,
      allowSeed: false,
    });
  });

  it("reads values for the flags that take one", () => {
    const args = parseArgs(["--dist", "build", "--state", "/tmp/s.json"]);
    assert.equal(args.dist, "build");
    assert.equal(args.state, "/tmp/s.json");
  });

  it("sets the boolean flags", () => {
    const args = parseArgs(["--dry-run", "--allow-seed"]);
    assert.equal(args.dryRun, true);
    assert.equal(args.allowSeed, true);
  });

  // Left unvalidated these become `undefined` and surface much later as a
  // TypeError from path.join, pointing at the wrong place entirely.
  it("rejects a flag whose value is missing", () => {
    assert.throws(() => parseArgs(["--dist"]), /--dist needs a value/);
    assert.throws(() => parseArgs(["--state"]), /--state needs a value/);
  });

  it("rejects a flag swallowing the next flag as its value", () => {
    assert.throws(
      () => parseArgs(["--dist", "--dry-run"]),
      /--dist needs a value/,
    );
  });

  it("rejects an unrecognised argument rather than ignoring it", () => {
    assert.throws(() => parseArgs(["--distt", "build"]), /Unrecognised/);
  });
});

// The one destructive-by-omission failure mode: a missing state file used to
// mean "first run", so a failed download looked exactly like a fresh install
// and re-seeding silently marked every pending delivery as sent. Exercised
// through the CLI because the guard sits in main(), which is the contract the
// deploy workflow actually depends on.
describe("seeding requires --allow-seed", () => {
  const scriptPath = fileURLToPath(
    new URL("../../scripts/send-webmentions.mjs", import.meta.url),
  );

  /** A minimal dist tree with one post carrying one outbound link. */
  const makeDist = () => {
    const root = mkdtempSync(join(tmpdir(), "send-webmentions-test-"));
    const postDir = join(root, "dist", "posts", "hello");
    mkdirSync(postDir, { recursive: true });
    writeFileSync(
      join(postDir, "index.html"),
      `<!doctype html><html><body><main id="main-content">` +
        `<article id="article"><p><a href="https://example.com/a/">a</a></p></article>` +
        `</main></body></html>`,
    );
    return root;
  };

  const run = (root, extraArgs) =>
    spawnSync(
      process.execPath,
      [
        scriptPath,
        "--dist",
        join(root, "dist"),
        "--state",
        join(root, "sent.json"),
        ...extraArgs,
      ],
      { encoding: "utf8" },
    );

  it("refuses to seed when the state file is absent", () => {
    const root = makeDist();
    try {
      const result = run(root, []);
      assert.equal(result.status, 1);
      assert.match(result.stderr + result.stdout, /Pass --allow-seed/);
      // Nothing written: a later run can still recover the real state.
      assert.equal(existsSync(join(root, "sent.json")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("seeds when the first run is stated explicitly", () => {
    const root = makeDist();
    try {
      const result = run(root, ["--allow-seed"]);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /Seeded state/);
      const state = JSON.parse(readFileSync(join(root, "sent.json"), "utf8"));
      assert.deepEqual(Object.keys(state.targets ?? {}), []);
      assert.equal(Object.keys(state.posts).length, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates the state directory it was pointed at", () => {
    const root = makeDist();
    try {
      const nested = join(root, "deep", "nested", "sent.json");
      const result = spawnSync(
        process.execPath,
        [
          scriptPath,
          "--dist",
          join(root, "dist"),
          "--state",
          nested,
          "--allow-seed",
        ],
        { encoding: "utf8" },
      );
      assert.equal(result.status, 0);
      assert.equal(existsSync(nested), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// `redirect: "follow"` reapplies no guard after the first URL. Verified
// against a local server: a public page that 302s to a link-local address puts
// the runner on that service, and a 307 on the endpoint POST replays the body
// there verbatim. These stub fetch so the ordinary hops can use public
// hostnames — a loopback test server is itself a blocked host.
describe("guardedFetch — the host guard survives redirects", () => {
  /** Replace global fetch with a scripted responder; returns the call log. */
  const withFetch = async (script, run) => {
    const calls = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      calls.push({
        url,
        method: init?.method ?? "GET",
        body: init?.body,
        init,
      });
      const step = script(url, calls.length);
      return new Response(step.body ?? "", {
        status: step.status,
        headers: step.headers ?? {},
      });
    };
    try {
      return { result: await run(), calls };
    } finally {
      globalThis.fetch = real;
    }
  };

  const redirectTo = (location, status = 302) => ({
    status,
    headers: { location },
  });
  const ok = { status: 200, body: "done" };

  it("follows an ordinary chain and returns the final response", async () => {
    const { result, calls } = await withFetch(
      (url) =>
        url === "http://example.com/a"
          ? redirectTo("https://example.com/a", 301)
          : ok,
      () => guardedFetch("http://example.com/a"),
    );
    assert.equal(result.status, 200);
    assert.deepEqual(
      calls.map((c) => c.url),
      ["http://example.com/a", "https://example.com/a"],
    );
  });

  it("resolves a relative Location against the current URL", async () => {
    const { calls } = await withFetch(
      (url) => (url.endsWith("/wm") ? ok : redirectTo("/wm")),
      () => guardedFetch("https://example.com/deep/page"),
    );
    assert.equal(calls[1].url, "https://example.com/wm");
  });

  // The whole point: the blocked host must never be requested at all.
  it("refuses a redirect into a blocked host without requesting it", async () => {
    const { calls } = await withFetch(
      () => redirectTo("http://169.254.169.254/latest/meta"),
      async () => {
        const err = await assert.rejects(
          () => guardedFetch("https://example.com/page"),
          /blocked host/,
        );
        return err;
      },
    );
    assert.deepEqual(
      calls.map((c) => c.url),
      ["https://example.com/page"],
    );
  });

  it("classifies a blocked redirect as refused, not transient", async () => {
    await withFetch(
      () => redirectTo("http://127.0.0.1:8080/"),
      async () => {
        await assert.rejects(() => guardedFetch("https://example.com/page"), {
          kind: "refused",
        });
      },
    );
  });

  it("refuses a non-http(s) redirect", async () => {
    await withFetch(
      () => redirectTo("data:text/html,x"),
      () =>
        assert.rejects(() => guardedFetch("https://example.com/page"), /data:/),
    );
  });

  it("caps the chain rather than looping forever", async () => {
    const { calls } = await withFetch(
      (_url, n) => redirectTo(`https://example.com/${n}`),
      () =>
        assert.rejects(
          () => guardedFetch("https://example.com/0"),
          /too many redirects/,
        ),
    );
    assert.equal(calls.length, MAX_REDIRECTS + 1);
  });

  it("hands back a 30x carrying no Location instead of following it", async () => {
    const { result, calls } = await withFetch(
      () => ({ status: 302 }),
      () => guardedFetch("https://example.com/page"),
    );
    assert.equal(result.status, 302);
    assert.equal(calls.length, 1);
  });

  describe("method rewriting mirrors the fetch spec", () => {
    const post = {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "webmention-sender",
      },
      body: "source=s&target=t",
    };

    for (const status of [301, 302]) {
      it(`turns POST into GET on ${status} and drops the body`, async () => {
        const { calls } = await withFetch(
          (url) =>
            url.endsWith("/b")
              ? ok
              : redirectTo("https://example.com/b", status),
          () => guardedFetch("https://example.com/a", post),
        );
        assert.equal(calls[1].method, "GET");
        assert.equal(calls[1].body, undefined);
        // A content-type describing a body that no longer exists.
        assert.equal(calls[1].init.headers["content-type"], undefined);
        assert.equal(calls[1].init.headers["user-agent"], "webmention-sender");
      });
    }

    it("turns POST into GET on 303", async () => {
      const { calls } = await withFetch(
        (url) =>
          url.endsWith("/b") ? ok : redirectTo("https://example.com/b", 303),
        () => guardedFetch("https://example.com/a", post),
      );
      assert.equal(calls[1].method, "GET");
      assert.equal(calls[1].body, undefined);
    });

    // The spec rewrites everything but GET and HEAD; a HEAD that came back as
    // a GET would fetch a body the caller never asked for.
    it("leaves HEAD alone on 303", async () => {
      const { calls } = await withFetch(
        (url) =>
          url.endsWith("/b") ? ok : redirectTo("https://example.com/b", 303),
        () => guardedFetch("https://example.com/a", { method: "HEAD" }),
      );
      assert.equal(calls[1].method, "HEAD");
    });

    // fetch normalizes the methods it knows, so "post" goes out as a POST.
    // Comparing the caller's spelling would leave the body on a 301/302.
    it("rewrites a lowercased post on 302", async () => {
      const { calls } = await withFetch(
        (url) =>
          url.endsWith("/b") ? ok : redirectTo("https://example.com/b"),
        () =>
          guardedFetch("https://example.com/a", { ...post, method: "post" }),
      );
      assert.equal(calls[1].method, "GET");
      assert.equal(calls[1].body, undefined);
    });

    it("leaves a lowercased head alone on 303", async () => {
      const { calls } = await withFetch(
        (url) =>
          url.endsWith("/b") ? ok : redirectTo("https://example.com/b", 303),
        () => guardedFetch("https://example.com/a", { method: "head" }),
      );
      assert.equal(calls[1].method, "head");
    });

    // Receivers put http->https 308s in front of endpoints; dropping the body
    // there would deliver a webmention that says nothing.
    for (const status of [307, 308]) {
      it(`preserves method and body on ${status}`, async () => {
        const { calls } = await withFetch(
          (url) =>
            url.endsWith("/b")
              ? ok
              : redirectTo("https://example.com/b", status),
          () => guardedFetch("https://example.com/a", post),
        );
        assert.equal(calls[1].method, "POST");
        assert.equal(calls[1].body, "source=s&target=t");
        assert.equal(
          calls[1].init.headers["content-type"],
          "application/x-www-form-urlencoded",
        );
      });
    }
  });

  describe("header handling mirrors the fetch spec", () => {
    // fetch lowercases header names on the wire, so a delete that matches the
    // caller's spelling instead would leave the stale header in place.
    it("drops a capitalised Content-Type when the body goes", async () => {
      const { calls } = await withFetch(
        (url) =>
          url.endsWith("/b") ? ok : redirectTo("https://example.com/b"),
        () =>
          guardedFetch("https://example.com/a", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "source=s&target=t",
          }),
      );
      // Read it back through Headers: asserting on the lowercase key alone
      // would pass while a stale "Content-Type" sat right beside it.
      assert.equal(
        new Headers(calls[1].init.headers).get("content-type"),
        null,
      );
    });

    // A Headers instance spreads to {}, which would have quietly dropped
    // every header — the user-agent this sender identifies itself with above
    // all — on the first hop.
    it("carries a Headers instance across a hop", async () => {
      const { calls } = await withFetch(
        (url) =>
          url.endsWith("/b") ? ok : redirectTo("https://example.com/b"),
        () =>
          guardedFetch("https://example.com/a", {
            headers: new Headers({ "user-agent": "webmention-sender" }),
          }),
      );
      assert.equal(calls[1].init.headers["user-agent"], "webmention-sender");
    });

    it("carries entry-array headers across a hop", async () => {
      const { calls } = await withFetch(
        (url) =>
          url.endsWith("/b") ? ok : redirectTo("https://example.com/b"),
        () =>
          guardedFetch("https://example.com/a", {
            headers: [["user-agent", "webmention-sender"]],
          }),
      );
      assert.equal(calls[1].init.headers["user-agent"], "webmention-sender");
    });

    // The host guard says where we may go; it cannot stop a public host from
    // keeping what we hand it once we arrive.
    it("strips credentials on a hop that crosses origins", async () => {
      const { calls } = await withFetch(
        (url) =>
          url.startsWith("https://other.example.org")
            ? ok
            : redirectTo("https://other.example.org/b"),
        () =>
          guardedFetch("https://example.com/a", {
            headers: {
              Authorization: "Bearer secret",
              cookie: "session=secret",
              "user-agent": "webmention-sender",
            },
          }),
      );
      assert.equal(calls[1].init.headers["authorization"], undefined);
      assert.equal(calls[1].init.headers["cookie"], undefined);
      // Only the credentials go; the rest of the request is unchanged.
      assert.equal(calls[1].init.headers["user-agent"], "webmention-sender");
    });

    // The spec drops every header that described the body, not just the one
    // naming its type: a surviving content-encoding announces a gzip payload
    // that the rewritten GET no longer carries.
    it("drops every body header when the body goes", async () => {
      const { calls } = await withFetch(
        (url) =>
          url.endsWith("/b") ? ok : redirectTo("https://example.com/b"),
        () =>
          guardedFetch("https://example.com/a", {
            method: "POST",
            headers: {
              "content-type": "application/x-www-form-urlencoded",
              "content-encoding": "gzip",
              "content-language": "en",
              "content-location": "/a",
              "user-agent": "webmention-sender",
            },
            body: "source=s&target=t",
          }),
      );
      const carried = new Headers(calls[1].init.headers);
      for (const name of [
        "content-type",
        "content-encoding",
        "content-language",
        "content-location",
      ]) {
        assert.equal(carried.get(name), null, `${name} survived the rewrite`);
      }
      assert.equal(carried.get("user-agent"), "webmention-sender");
    });

    // The hop receivers actually put in front of an endpoint. Same host, but
    // a different scheme is a different origin, so credentials still go.
    it("strips credentials on an http->https hop", async () => {
      const { calls } = await withFetch(
        (url) =>
          url.startsWith("https://") ? ok : redirectTo("https://example.com/a"),
        () =>
          guardedFetch("http://example.com/a", {
            headers: { authorization: "Bearer secret" },
          }),
      );
      assert.equal(calls[1].init.headers["authorization"], undefined);
    });

    // Stripping is one-way: coming back to where the credentials would have
    // been welcome does not re-earn them, because the middle host saw the
    // chain and could have chosen the return address.
    it("does not restore credentials when a later hop returns home", async () => {
      const { calls } = await withFetch(
        (url) => {
          if (url === "https://example.com/a")
            return redirectTo("https://other.example.org/b");
          if (url === "https://other.example.org/b")
            return redirectTo("https://example.com/c");
          return ok;
        },
        () =>
          guardedFetch("https://example.com/a", {
            headers: { authorization: "Bearer secret" },
          }),
      );
      assert.equal(calls[2].url, "https://example.com/c");
      assert.equal(calls[2].init.headers["authorization"], undefined);
    });

    // Headers throws on a malformed name. fetch would have thrown first on a
    // real request, so arriving here means this script built the header —
    // permanent, and nothing a receiver can fix by being asked ten times.
    it("classifies unusable headers as refused, not transient", async () => {
      await withFetch(
        () => redirectTo("https://example.com/b"),
        () =>
          assert.rejects(
            () =>
              guardedFetch("https://example.com/a", {
                headers: { "bad header name": "x" },
              }),
            { kind: "refused", message: /unusable request headers/ },
          ),
      );
    });

    it("keeps credentials on a same-origin hop", async () => {
      const { calls } = await withFetch(
        (url) =>
          url.endsWith("/b") ? ok : redirectTo("https://example.com/b"),
        () =>
          guardedFetch("https://example.com/a", {
            headers: { authorization: "Bearer secret" },
          }),
      );
      assert.equal(calls[1].init.headers["authorization"], "Bearer secret");
    });
  });
});

describe("findPostPages", () => {
  const withTree = async (build, run) => {
    const root = mkdtempSync(join(tmpdir(), "send-webmentions-find-"));
    try {
      build(root);
      return await run(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };

  it("lists built post pages relative to dist", async () => {
    await withTree(
      (root) => {
        mkdirSync(join(root, "posts", "b"), { recursive: true });
        mkdirSync(join(root, "posts", "a"), { recursive: true });
        writeFileSync(join(root, "posts", "a", "index.html"), "");
        writeFileSync(join(root, "posts", "b", "index.html"), "");
        // Not a post page, and must not be picked up.
        writeFileSync(join(root, "posts", "a", "other.html"), "");
      },
      async (root) => {
        assert.deepEqual(await findPostPages(root), [
          join("posts", "a", "index.html"),
          join("posts", "b", "index.html"),
        ]);
      },
    );
  });

  it("explains an unbuilt tree in terms of the build", async () => {
    await withTree(
      () => {},
      (root) => assert.rejects(() => findPostPages(root), /run the build/),
    );
  });

  // The friendly message used to swallow every readdir failure. A permission
  // or filesystem fault reported as "run the build" sends whoever reads the
  // deploy log looking in the wrong place entirely.
  it("rethrows a filesystem fault instead of blaming the build", async () => {
    await withTree(
      (root) => {
        // A file where the posts directory should be: readdir gives ENOTDIR,
        // which is deterministic everywhere, unlike a chmod-based EACCES.
        writeFileSync(join(root, "posts"), "not a directory");
      },
      async (root) => {
        await assert.rejects(
          () => findPostPages(root),
          (err) => {
            assert.equal(err.code, "ENOTDIR");
            assert.doesNotMatch(err.message, /run the build/);
            return true;
          },
        );
      },
    );
  });

  it("keeps the underlying error as the cause when the tree is missing", async () => {
    await withTree(
      () => {},
      async (root) => {
        const err = await findPostPages(root).catch((e) => e);
        assert.equal(err.cause?.code, "ENOENT");
      },
    );
  });
});
