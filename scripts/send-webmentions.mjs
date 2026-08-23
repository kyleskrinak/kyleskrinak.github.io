#!/usr/bin/env node
/**
 * Outbound webmention sender.
 *
 * Runs AFTER the production deploy, over the built `dist/`, and notifies every
 * site a blog post links to. Zero runtime dependencies beyond `linkedom`
 * (already a devDependency) and native fetch.
 *
 * IDEMPOTENCE is the whole design. State is a per-post record of
 *   { hash, sent } — the sha256 of the post's sorted outbound link set, plus
 * the list of targets already delivered successfully. The hash answers "did
 * anything change" in O(1); the `sent` list answers "which pair is new", which
 * a hash alone cannot. Both are needed:
 *
 *   - rebuild, no content change  -> hash matches, sent covers links -> 0 sends
 *   - edit an old post's prose    -> link set unchanged -> hash matches -> 0 sends
 *   - add one link to an old post -> hash differs, exactly one link missing
 *                                    from `sent` -> exactly 1 send
 *
 * Failures are per-target and non-fatal. Only successful deliveries are written
 * to `sent`, so a receiver that is down today is simply still-pending tomorrow
 * and retries on the next deploy.
 *
 * Targets that keep failing stop being probed. State also carries a per-target
 * record of { failures, kind, lastAttempt }; after a limit that depends on the
 * failure kind, the target is skipped entirely, and reconsidered once every 30
 * days thereafter. A success clears the record. "No endpoint advertised" is one
 * of those kinds rather than a delivery: sites adopt webmentions, and `sent` is
 * permanent, so a single probe must not settle the question forever.
 *
 * Targets are never pruned from `sent` when a link is removed from a post.
 * Pruning would mean that deleting a link and later restoring it re-notifies a
 * site that already knows — the exact re-notification this script exists to
 * prevent. The log grows by URLs-ever-linked, which is small and bounded by
 * content.
 *
 * Usage:
 *   node scripts/send-webmentions.mjs --dist dist --state path/to/sent.json
 *   node scripts/send-webmentions.mjs --dry-run     # report only, never sends
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseHTML } from "linkedom";

/**
 * The only host allowed to originate webmentions.
 *
 * Defence against this step being copy-pasted into another workflow: staging
 * builds the same content under kyleskrinak.github.io, and sending from there
 * would publish the wrong canonical identity to every receiver. Overridable
 * only for tests.
 */
const EXPECTED_HOST =
  process.env.WEBMENTION_EXPECTED_HOST || "kyle.skrinak.com";

/** Only posts originate webmentions — see README note in the workflow step. */
const POSTS_DIR = "posts";

const STATE_VERSION = 2;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Consecutive-failure limits before a target stops being probed.
 *
 * Three limits, because a 403, a 503 and "no endpoint advertised" are not the
 * same signal. A 4xx is a working server answering the question: it has looked
 * at the request and said no, and it will keep saying no. Three identical
 * answers is enough. Everything else — 5xx, a timeout, a DNS failure, a
 * connection reset — is the absence of an answer, which says nothing about
 * whether the site will accept a mention once it is back. That case is
 * deliberately generous: at this repo's deploy cadence ten attempts spans well
 * over a week, so a site down for a week of deploys is still picked up when it
 * returns.
 *
 * "No endpoint" needs no repetition at all: the page was fetched and parsed
 * successfully and advertised nothing, and a second identical fetch on the next
 * deploy cannot say anything new. One observation, then the 30-day
 * reconsideration — which is the whole point of routing it here rather than
 * into the permanent `sent` log.
 */
const MAX_REFUSED_ATTEMPTS = 3;
const MAX_TRANSIENT_ATTEMPTS = 10;
const MAX_NO_ENDPOINT_ATTEMPTS = 1;

/**
 * How long a given-up target rests before one more attempt.
 *
 * Giving up permanently would be a decision made from a handful of requests,
 * and sites change: a blog adds webmention support, a 403 turns out to have
 * been a WAF rule someone since relaxed. Reconsideration is automatic and
 * time-based rather than deploy-count-based, so it does not accelerate just
 * because a busy week produced twenty deploys. A failed re-probe updates
 * lastAttempt, so the next reconsideration is another interval away.
 */
export const REPROBE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Pure functions (unit-tested in tests/unit/send-webmentions.test.mjs)
// ---------------------------------------------------------------------------

/**
 * Extract the outbound link set for one post page.
 *
 * Scoped to `#article` so navigation, the footer h-card, the five SOCIALS
 * rel="me" anchors, the webring, share links and the prev/next post buttons
 * are all excluded — those are chrome, not something the post is saying.
 *
 * @param {string} html - full page HTML
 * @param {string} pageUrl - absolute URL of the page, used to resolve hrefs
 * @returns {string[]} sorted, deduped, absolute http(s) URLs on other hosts
 */
export function extractLinks(html, pageUrl) {
  const { document } = parseHTML(html);
  const article = document.getElementById("article");
  if (!article) return [];

  const sourceHost = new URL(pageUrl).hostname;
  const found = new Set();

  for (const anchor of article.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href) continue;

    let url;
    try {
      url = new URL(href, pageUrl);
    } catch {
      continue; // unparseable href — not our problem to fix here
    }

    // mailto:, tel:, javascript: and friends are not webmention targets.
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;

    // Self-links are not mentions. Sending them would notify our own inbox
    // about our own content.
    if (url.hostname === sourceHost) continue;

    // Fragments identify a place within the target, not a different target.
    // Two links to #a and #b of the same page are one mention, not two.
    url.hash = "";

    found.add(url.href);
  }

  return [...found].sort();
}

/**
 * Stable hash of a link set. Sorted+deduped input makes this order-independent,
 * so re-rendering that shuffles DOM order does not look like a content change.
 *
 * @param {string[]} links
 * @returns {string} sha256 hex digest
 */
export function hashLinks(links) {
  const normalized = [...new Set(links)].sort();
  // JSON rather than join(): a delimiter-joined list collides on edge cases
  // (an empty set and a set holding one empty string both flatten to ""),
  // and URLs cannot contain an unescaped quote, so the encoding is injective.
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/**
 * Decide what to send for one post, given its current links and prior state.
 *
 * @param {string[]} currentLinks
 * @param {{hash?: string, sent?: string[]}|undefined} entry
 * @returns {{unchanged: boolean, pending: string[], hash: string}}
 */
export function diffPost(currentLinks, entry) {
  const hash = hashLinks(currentLinks);
  const sent = new Set(entry?.sent ?? []);
  const pending = currentLinks.filter((link) => !sent.has(link));
  // Both conditions matter: the hash can match while a target is still pending
  // because a previous run's delivery failed.
  const unchanged = entry?.hash === hash && pending.length === 0;
  return { unchanged, pending, hash };
}

/**
 * Classify a failed send, to decide which attempt limit applies.
 *
 * @param {{status?: number}} result
 * @returns {"refused"|"transient"}
 */
export function classifyFailure(result) {
  const status = result?.status;
  // A definitive "no" from a server that is up and answering. 404/410 mean
  // the target page itself is gone, which is equally final.
  if ([401, 403, 404, 405, 410, 451].includes(status)) return "refused";
  // Everything else — 5xx, 429, and the no-status case that covers timeouts,
  // DNS failures and connection resets — is an absent answer, not a refusal.
  return "transient";
}

/**
 * @param {"refused"|"transient"|"no-endpoint"} kind
 * @returns {number}
 */
export function attemptLimitFor(kind) {
  if (kind === "no-endpoint") return MAX_NO_ENDPOINT_ATTEMPTS;
  return kind === "refused" ? MAX_REFUSED_ATTEMPTS : MAX_TRANSIENT_ATTEMPTS;
}

/**
 * Should this target be skipped without a network request?
 *
 * @param {{failures: number, kind: string, lastAttempt: string}|undefined} record
 * @param {number} now - epoch ms, injectable for tests
 * @returns {boolean}
 */
export function shouldSkipTarget(record, now = Date.now()) {
  if (!record) return false;
  if (record.failures < attemptLimitFor(record.kind)) return false;

  const last = Date.parse(record.lastAttempt ?? "");
  // A missing or unparseable timestamp is corrupt state. Fail towards
  // trying again: a wasted request is cheaper than a mention never sent.
  if (!Number.isFinite(last)) return false;

  return now - last < REPROBE_AFTER_MS;
}

/**
 * Fold one failure into a target's record.
 *
 * The count is monotonic — a different failure kind does not restart it, it
 * only changes which limit applies. Resetting on a change of kind would let
 * a target alternating 503 and 403 evade every limit forever.
 *
 * @param {{failures?: number}|undefined} record
 * @param {"refused"|"transient"|"no-endpoint"} kind
 * @param {number} now
 * @returns {{failures: number, kind: string, lastAttempt: string}}
 */
export function recordFailure(record, kind, now = Date.now()) {
  return {
    failures: (record?.failures ?? 0) + 1,
    kind,
    lastAttempt: new Date(now).toISOString(),
  };
}

/**
 * Find a target's webmention endpoint, per the W3C discovery algorithm:
 * Link header first, then the first <link> or <a> with rel=webmention in
 * document order. Relative endpoints resolve against the post-redirect URL.
 *
 * @param {{headers: {get(name: string): string|null}, url: string}} response
 * @param {string} html
 * @returns {string|null} absolute endpoint URL, or null if none advertised
 */
export function discoverEndpoint(response, html) {
  const baseUrl = response.url;

  const linkHeader = response.headers.get("link");
  if (linkHeader) {
    const fromHeader = parseLinkHeader(linkHeader);
    if (fromHeader) {
      try {
        return new URL(fromHeader, baseUrl).href;
      } catch {
        /* fall through to the markup */
      }
    }
  }

  const { document } = parseHTML(html);
  for (const el of document.querySelectorAll("link[rel], a[rel]")) {
    // rel is a space-separated, case-insensitive token list. Matching by hand
    // rather than with [rel~="webmention" i] keeps this independent of the
    // parser's attribute-selector case handling.
    const tokens = (el.getAttribute("rel") || "").toLowerCase().split(/\s+/);
    if (!tokens.includes("webmention")) continue;

    // An empty href means "this page is the endpoint" — resolving "" against
    // the base yields exactly that, so it needs no special case.
    const href = el.getAttribute("href");
    if (href === null) continue;
    try {
      return new URL(href, baseUrl).href;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Pull the first rel=webmention target out of an HTTP Link header.
 *
 * @param {string} headerValue
 * @returns {string|null}
 */
export function parseLinkHeader(headerValue) {
  // Split on commas that separate entries, not commas inside <...>.
  for (const part of headerValue.split(/,(?=\s*<)/)) {
    const match = part.match(/<([^>]*)>(.*)/s);
    if (!match) continue;
    const [, target, params] = match;
    const relMatch = params.match(
      /;\s*rel\s*=\s*("([^"]*)"|'([^']*)'|([^;,\s]+))/i,
    );
    if (!relMatch) continue;
    const relValue = relMatch[2] ?? relMatch[3] ?? relMatch[4] ?? "";
    if (relValue.toLowerCase().split(/\s+/).includes("webmention")) {
      return target;
    }
  }
  return null;
}

/**
 * Map a built HTML file to its canonical absolute URL.
 *
 * @param {string} relativePath - path relative to dist, e.g. posts/foo/index.html
 * @param {string} siteUrl - absolute site root, with or without trailing slash
 * @returns {string}
 */
export function pageUrlFor(relativePath, siteUrl) {
  const withoutIndex = relativePath.replace(/index\.html$/, "");
  const base = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;
  const url = new URL(withoutIndex, base);
  // trailingSlash: "always" in astro.config.ts — canonical URLs end in /.
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

async function findPostPages(distDir) {
  const root = path.join(distDir, POSTS_DIR);
  let entries;
  try {
    entries = await readdir(root, { recursive: true, withFileTypes: true });
  } catch {
    throw new Error(`No ${root} directory — run the build before this script.`);
  }
  return entries
    .filter((e) => e.isFile() && e.name === "index.html")
    .map((e) =>
      path.relative(distDir, path.join(e.parentPath ?? e.path, e.name)),
    )
    .sort();
}

async function loadState(statePath) {
  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed?.posts !== "object" || parsed.posts === null) {
      throw new Error(`Unrecognised state file shape in ${statePath}`);
    }
    // v1 had no per-target failure record. Upgrade in place rather than
    // throwing: a hard failure here would be indistinguishable from a lost
    // state file and would re-seed, silently dropping the send history.
    if (parsed.version === 1) {
      return { version: STATE_VERSION, posts: parsed.posts, targets: {} };
    }
    if (parsed.version !== STATE_VERSION) {
      throw new Error(`Unrecognised state file shape in ${statePath}`);
    }
    return { ...parsed, targets: parsed.targets ?? {} };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function sendOne(source, target) {
  const probe = await fetch(target, {
    redirect: "follow",
    headers: { "user-agent": `webmention-sender (+${source})` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!probe.ok) {
    return {
      ok: false,
      status: probe.status,
      reason: `target returned ${probe.status}`,
    };
  }

  const endpoint = discoverEndpoint(probe, await probe.text());
  if (!endpoint)
    return { ok: false, reason: "no endpoint advertised", noEndpoint: true };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": `webmention-sender (+${source})`,
    },
    body: new URLSearchParams({ source, target }).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok)
    return {
      ok: false,
      status: res.status,
      reason: `endpoint returned ${res.status}`,
    };
  return { ok: true, endpoint, status: res.status };
}

function parseArgs(argv) {
  const args = {
    dist: "dist",
    state: ".webmention-state/sent.json",
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dist") args.dist = argv[++i];
    else if (argv[i] === "--state") args.state = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const siteUrl = process.env.SITE_URL || "https://kyle.skrinak.com/";

  // Safety assertion. A no-op plus a loud log, never a failure: this step is
  // best-effort by design and must not be the thing that breaks a deploy.
  const host = new URL(siteUrl).hostname;
  if (host !== EXPECTED_HOST) {
    console.log(
      `Source host is ${host}, not ${EXPECTED_HOST} — not sending. ` +
        `Webmentions originate from the canonical production host only.`,
    );
    return;
  }

  const pages = await findPostPages(args.dist);
  const prior = await loadState(args.state);
  const seeding = prior === null;

  const state = prior ?? { version: STATE_VERSION, posts: {}, targets: {} };
  const now = Date.now();
  let considered = 0;
  let sentCount = 0;
  let failedCount = 0;
  let noEndpointCount = 0;
  let skippedCount = 0;

  for (const relativePath of pages) {
    const pageUrl = pageUrlFor(relativePath, siteUrl);
    const html = await readFile(path.join(args.dist, relativePath), "utf8");
    const links = extractLinks(html, pageUrl);
    const entry = state.posts[pageUrl];
    const { unchanged, pending, hash } = diffPost(links, entry);

    if (seeding) {
      // FIRST-RUN GUARD. No state means we cannot tell "never sent" from
      // "state lost". Assume everything already went out: seed the log from
      // current content and send nothing. Losing sent.json therefore costs a
      // quiet re-seed, never a re-notification storm across the whole archive.
      state.posts[pageUrl] = { hash, sent: links };
      considered += links.length;
      continue;
    }

    if (unchanged) continue;

    considered += pending.length;
    const sent = new Set(entry?.sent ?? []);

    for (const target of pending) {
      if (args.dryRun) {
        console.log(`[dry-run] would send ${pageUrl} -> ${target}`);
        continue;
      }
      // Targets that have given up cost nothing: no request is made at all.
      if (shouldSkipTarget(state.targets[target], now)) {
        skippedCount++;
        continue;
      }

      let result;
      try {
        result = await sendOne(pageUrl, target);
      } catch (err) {
        // No response at all — timeout, DNS, connection reset. No status, so
        // classifyFailure lands on "transient", which is correct.
        result = { ok: false, reason: err.message };
      }
      if (result.ok) {
        // Only successes are recorded, so anything that failed is still
        // pending on the next deploy and retries then.
        sent.add(target);
        sentCount++;
        // Success clears the failure history outright: whatever was wrong is
        // demonstrably over, and the next outage starts counting from zero.
        delete state.targets[target];
        console.log(`sent ${pageUrl} -> ${target} (${result.status})`);
      } else if (result.noEndpoint) {
        // Not a failure, but not permanent either. This goes in `targets`, not
        // `sent`: `sent` is never pruned by design, so writing here would mean
        // one probe decides forever that a site will never adopt webmentions —
        // a stronger claim than we make about a server that actively refuses
        // us. Recorded as its own kind, it stops being probed immediately and
        // is reconsidered every 30 days like any other give-up.
        state.targets[target] = recordFailure(
          state.targets[target],
          "no-endpoint",
          now,
        );
        noEndpointCount++;
      } else {
        const kind = classifyFailure(result);
        const record = recordFailure(state.targets[target], kind, now);
        state.targets[target] = record;
        failedCount++;
        const limit = attemptLimitFor(kind);
        const verdict =
          record.failures >= limit
            ? `giving up after ${record.failures} (${kind}); one more attempt in 30 days`
            : `retry next deploy (${kind} ${record.failures}/${limit})`;
        console.log(`${verdict}: ${target} — ${result.reason}`);
      }
    }

    state.posts[pageUrl] = { hash, sent: [...sent].sort() };
  }

  if (!args.dryRun) {
    // The workflow does `mkdir -p`, but the documented CLI contract accepts an
    // arbitrary --state path and must hold on its own. Reachable only on a
    // seeding run — a run that read the file proves its directory exists — so
    // this converts a confusing post-run crash, not a lost delivery.
    await mkdir(path.dirname(path.resolve(args.state)), { recursive: true });
    await writeFile(args.state, `${JSON.stringify(state, null, 2)}\n`);
  }

  if (seeding) {
    console.log(
      `Seeded state from ${pages.length} posts / ${considered} links — nothing sent (first run).`,
    );
  } else {
    console.log(
      `${pages.length} posts scanned, ${considered} targets examined, ` +
        `${sentCount} sent, ${noEndpointCount} without an endpoint, ` +
        `${failedCount} deferred, ${skippedCount} skipped (previously gave up).`,
    );
  }
}

// Only run when invoked directly, so the pure functions above stay importable.
// pathToFileURL rather than a `file://` template literal: import.meta.url is a
// URL and percent-encodes characters a path may legitimately contain, so a
// checkout under a directory with a space compares unequal and main() silently
// never runs.
// argv[1] is absent under `node -e`, the REPL and some worker contexts;
// pathToFileURL throws on undefined, and importing this module for its pure
// functions must never throw.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err) => {
    console.error(`Webmention sending failed: ${err.message}`);
    process.exitCode = 1;
  });
}
