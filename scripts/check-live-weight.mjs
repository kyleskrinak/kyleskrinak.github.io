#!/usr/bin/env node
/**
 * Live page weight monitor.
 *
 * Loads the real deployed homepage in a browser and sums the uncompressed
 * (decoded) bytes of every request the page actually makes on a cold
 * load — first-party assets AND third-party resources (analytics, tag
 * managers, etc.) that only exist once the page executes client-side JS.
 * This uses the 512 KiB figure popularized by the 512KB Club as a round-
 * number budget; the club's own methodology measures uncompressed size via
 * the Cloudflare URL Scanner, so this script gates on decoded bytes to
 * match. Transfer (compressed) bytes are also reported for comparison with
 * DebugBear-style tools, which report transfer size.
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

// Uses the CDP Network domain directly (not response.headers()['content-length'],
// which is frequently absent over HTTP/2 or chunked transfer-encoding). Network.dataReceived
// accumulates decoded (uncompressed) body bytes per request; Network.loadingFinished reports
// encodedDataLength, the transfer (compressed) bytes actually received on the wire.
async function collectRequests(url) {
  const browser = await chromium.launch();
  const requestMeta = new Map(); // requestId -> { url, type }
  const decodedBytesByRequestId = new Map();
  const transferBytesByRequestId = new Map();

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
      const prev = decodedBytesByRequestId.get(event.requestId) ?? 0;
      decodedBytesByRequestId.set(event.requestId, prev + (event.dataLength ?? 0));
    });
    client.on('Network.loadingFinished', event => {
      transferBytesByRequestId.set(event.requestId, event.encodedDataLength ?? 0);
    });

    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    // Late-firing analytics/tag-manager beacons can land after load.
    await page.waitForTimeout(5_000);
  } finally {
    await browser.close();
  }

  const entries = [];
  for (const [requestId, meta] of requestMeta) {
    const bytes = decodedBytesByRequestId.get(requestId) ?? 0;
    const finished = transferBytesByRequestId.has(requestId);
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
  return entries;
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
