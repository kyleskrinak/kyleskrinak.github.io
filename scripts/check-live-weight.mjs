#!/usr/bin/env node
/**
 * Live page weight monitor.
 *
 * Loads the real deployed homepage in a browser and sums the uncompressed
 * (decoded) bytes of every request the page actually makes on a cold
 * load — first-party assets AND third-party resources (analytics, tag
 * managers, etc.) that only exist once the page executes client-side JS.
 * This uses the 512 KiB figure popularized by the 512KB Club as a round-
 * number budget; the club's own FAQ designates DebugBear's Page Size
 * Checker (debugbear.com/test/page-size-checker) as the tool to verify
 * against, and its "Full Size" column (uncompressed) is the metric that
 * matches the club's stated rule — its default "Size" column is transfer
 * bytes and reads much lower. This script gates on decoded bytes to match
 * that Full Size figure. Transfer (compressed) bytes are also reported.
 *
 * Playwright's Chromium — headless or headed — does not organically fetch
 * favicon/manifest-icon links the way DebugBear's own test does (confirmed
 * empirically: neither mode requested favicon.ico, apple-touch-icon.png,
 * site.webmanifest, or the manifest's icon files during a real cold load
 * of this site). Rather than depend on unreliable browser-internal
 * heuristics to coax those fetches, collectDeclaredIconResources() fetches
 * favicon.ico, the manifest file, and only the smallest manifest icon —
 * matching (by manual comparison) what DebugBear's own real-browser test
 * captured for this site, rather than exhaustively counting every declared
 * icon variant (apple-touch-icon, alternate favicon sizes, every manifest
 * size), which real page loads don't actually fetch.
 *
 * Unlike scripts/check-size.mjs (removed), this is NOT a build-time gate —
 * it can only run against a live, deployed site, so it's a nightly,
 * non-blocking monitor (see .github/workflows/weightwatch.yml) that opens
 * a tracking issue when the site drifts over budget.
 *
 * Known limitation: the CDP Network session is attached to the main page
 * target only. Requests issued by site-isolated cross-origin iframes
 * (OOPIFs) and by service/dedicated workers run on separate targets and
 * are not counted. Current third-party load (GTM, Cloudflare Insights)
 * executes in the main frame, so the gap is expected to be small.
 *
 * Usage:
 *   node scripts/check-live-weight.mjs [--url=<url>] [--budget=<bytes>]
 *
 * Exit codes:
 *   0 = within budget, 1 = over budget, 2 = usage/environment error.
 */

import { chromium } from '@playwright/test';

const DEFAULT_URL = 'https://kyle.skrinak.com/';
const DEFAULT_BUDGET_BYTES = 512 * 1024; // 512 KiB — 512KB Club threshold

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(2);
}

function parseArg(argv, prefix) {
  const arg = argv.find(a => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function parseBudget(argv) {
  const raw = parseArg(argv, '--budget=');
  if (raw === null) return DEFAULT_BUDGET_BYTES;
  const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(`Invalid --budget value: ${raw} (expected a positive integer of bytes)`);
  }
  return value;
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

// Scoped to match what DebugBear's real-browser Page Size Checker actually
// captured for this site (verified manually): favicon.ico, the manifest
// file itself, and only the smallest manifest icon — not every declared
// variant. Real browsers pick one "best" icon per purpose rather than
// fetching apple-touch-icon.png, alternate favicon sizes, or every manifest
// icon size; counting all of them (an earlier version of this function)
// overshoots what any real page load actually costs.
//
// The measurement fetch below lets the server negotiate its normal
// encoding (gzip/br) rather than forcing identity, so Content-Length
// reflects the real transfer size — forcing identity would make transfer
// size equal decoded size for these entries, which isn't representative
// (matters for site.webmanifest; negligible for already-compressed image
// formats like the favicon/icon files). fetch()'s own arrayBuffer() still
// transparently decompresses the body, so the decoded byte count is exact
// regardless of what encoding the server chose.
async function collectDeclaredIconResources(page, alreadyCapturedUrls) {
  const manifestUrl = await page.evaluate(() => {
    const link = document.querySelector('link[rel="manifest"]');
    return link?.href ?? null;
  });

  const candidateUrls = new Set();
  candidateUrls.add(new URL('/favicon.ico', page.url()).href);
  if (manifestUrl) candidateUrls.add(manifestUrl);

  if (manifestUrl) {
    try {
      const res = await fetch(manifestUrl, { headers: { 'Accept-Encoding': 'identity' } });
      const manifest = await res.json();
      // Only consider entries with an explicit purpose ("any"/"maskable") —
      // real PWA icon candidates — not a bare favicon-fallback entry with no
      // purpose field (this manifest lists one at 96x96 that real browsers
      // don't treat as an installable icon). Pick the smallest of those,
      // matching the one icon DebugBear's real-browser test fetched.
      const installableIcons = (manifest.icons ?? []).filter(icon => icon.purpose);
      const smallest = installableIcons.reduce((min, icon) => {
        const width = Number.parseInt(icon.sizes?.split('x')[0], 10) || Infinity;
        const minWidth = min ? Number.parseInt(min.sizes?.split('x')[0], 10) || Infinity : Infinity;
        return width < minWidth ? icon : min;
      }, null);
      if (smallest?.src) candidateUrls.add(new URL(smallest.src, manifestUrl).href);
    } catch {
      // Manifest fetch/parse failure shouldn't block the rest of the report.
    }
  }

  const results = [];
  for (const candidateUrl of candidateUrls) {
    if (alreadyCapturedUrls.has(candidateUrl)) continue;
    try {
      const res = await fetch(candidateUrl);
      if (!res.ok) continue; // e.g. no favicon.ico at this path
      const buffer = await res.arrayBuffer();
      const contentLength = Number(res.headers.get('content-length'));
      const transferBytes =
        Number.isSafeInteger(contentLength) && contentLength > 0 ? contentLength : buffer.byteLength;
      const type =
        candidateUrl === manifestUrl
          ? 'Manifest (declared, not organically fetched)'
          : 'Icon (declared, not organically fetched)';
      results.push({
        url: candidateUrl,
        type,
        bytes: buffer.byteLength,
        transferBytes,
      });
    } catch {
      // Unreachable resource shouldn't crash the whole report.
    }
  }
  return results;
}

// Uses the CDP Network domain directly (not response.headers()['content-length'],
// which is frequently absent over HTTP/2 or chunked transfer-encoding). Network.dataReceived
// accumulates decoded (uncompressed) body bytes per request; Network.loadingFinished reports
// encodedDataLength, the transfer (compressed) bytes actually received on the wire.
async function collectRequests(url) {
  const browser = await chromium.launch();
  const requestMeta = new Map(); // requestId -> { url, type }
  const decodedBytesByRequestId = new Map();
  const transferBytesByRequestId = new Map();
  const finishedRequestIds = new Set();

  try {
    const page = await browser.newPage();
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');

    client.on('Network.requestWillBeSent', event => {
      requestMeta.set(event.requestId, {
        url: event.request.url,
        type: event.type ?? 'other',
      });
    });
    client.on('Network.dataReceived', event => {
      const prevDecoded = decodedBytesByRequestId.get(event.requestId) ?? 0;
      decodedBytesByRequestId.set(event.requestId, prevDecoded + (event.dataLength ?? 0));
      const prevTransfer = transferBytesByRequestId.get(event.requestId) ?? 0;
      transferBytesByRequestId.set(event.requestId, prevTransfer + (event.encodedDataLength ?? 0));
    });
    client.on('Network.loadingFinished', event => {
      // Final authoritative total, overwriting the running dataReceived accumulation.
      transferBytesByRequestId.set(event.requestId, event.encodedDataLength ?? 0);
      finishedRequestIds.add(event.requestId);
    });

    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    // Late-firing analytics/tag-manager beacons can land after load.
    await page.waitForTimeout(5_000);

    const entries = [];
    for (const [requestId, meta] of requestMeta) {
      const bytes = decodedBytesByRequestId.get(requestId) ?? 0;
      const finished = finishedRequestIds.has(requestId);
      // Count partial bytes of requests still in flight (or failed) at
      // measurement end; skip only requests that received no data at all.
      if (!finished && bytes === 0) continue;
      entries.push({
        url: meta.url,
        type: meta.type,
        bytes,
        transferBytes: transferBytesByRequestId.get(requestId) ?? 0,
      });
    }

    const capturedUrls = new Set(entries.map(e => e.url));
    entries.push(...(await collectDeclaredIconResources(page, capturedUrls)));

    return entries;
  } finally {
    await browser.close();
  }
}

function aggregateByUrl(entries) {
  const byUrl = new Map();
  for (const entry of entries) {
    const existing = byUrl.get(entry.url);
    if (existing) {
      existing.bytes += entry.bytes;
      existing.transferBytes += entry.transferBytes;
      existing.count += 1;
    } else {
      byUrl.set(entry.url, { ...entry, count: 1 });
    }
  }
  return [...byUrl.values()];
}

async function main() {
  const argv = process.argv.slice(2);
  const url = parseArg(argv, '--url=') ?? DEFAULT_URL;
  const budget = parseBudget(argv);

  let entries;
  try {
    entries = await collectRequests(url);
  } catch (err) {
    fail(`Failed to load ${url}: ${errorMessage(err)}`);
  }

  const aggregated = aggregateByUrl(entries);
  aggregated.sort((a, b) => b.bytes - a.bytes);

  const total = aggregated.reduce((sum, e) => sum + e.bytes, 0);
  const transferTotal = aggregated.reduce((sum, e) => sum + e.transferBytes, 0);

  console.log(`Live page weight (cold load of ${url}):\n`);
  for (const { url: reqUrl, type, bytes, transferBytes, count } of aggregated) {
    const suffix = count > 1 ? ` ×${count}` : '';
    console.log(
      `  ${formatKiB(bytes).padStart(10)} uncompressed  ${formatKiB(transferBytes).padStart(10)} transfer  [${type}] ${reqUrl}${suffix}`
    );
  }
  console.log(`\n  Total (uncompressed): ${formatKiB(total)} (${total} bytes)`);
  console.log(`  Total (transfer):     ${formatKiB(transferTotal)} (${transferTotal} bytes)`);
  console.log(`  Budget:               ${formatKiB(budget)} (${budget} bytes)`);

  if (total > budget) {
    console.error(`\n❌ Over budget by ${formatKiB(total - budget)}.`);
    process.exit(1);
  }
  console.log(`\n✅ Within budget (${formatKiB(budget - total)} headroom).`);
}

main().catch(err => fail(errorMessage(err)));
