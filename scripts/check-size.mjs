#!/usr/bin/env node
/**
 * Homepage weight gate.
 *
 * Sums the uncompressed bytes a browser fetches on a cold load of the built
 * homepage (dist/index.html plus every local asset it references: stylesheets,
 * scripts, icons, images, and the implicit /favicon.ico request) and fails when
 * the total exceeds the budget. Mirrors how 512kb.club / GTmetrix measure page
 * weight; apple-touch-icon links are excluded because desktop browsers do not
 * fetch them on page load.
 *
 * Usage:
 *   node scripts/check-size.mjs [--budget=<bytes>]
 *
 * Requires a current build (npm run build). Exit codes:
 *   0 = within budget, 1 = over budget, 2 = usage/environment error.
 */

import { readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)), "dist");
const DEFAULT_BUDGET_BYTES = 150 * 1024; // 150 KiB — current homepage is ~135 KiB

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(2);
}

function parseBudget(argv) {
  const arg = argv.find((a) => a.startsWith("--budget="));
  if (!arg) return DEFAULT_BUDGET_BYTES;
  const value = Number(arg.slice("--budget=".length));
  if (!Number.isInteger(value) || value <= 0) {
    fail(`Invalid --budget value: ${arg.slice("--budget=".length)} (expected a positive integer of bytes)`);
  }
  return value;
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

/**
 * Extract local asset URLs a browser fetches when loading the page.
 * Regex-based on purpose: the input is our own Astro build output, not
 * arbitrary HTML.
 */
function collectAssetUrls(html) {
  const urls = new Set();

  // <link> tags: stylesheets and favicons; skip apple-touch-icon and non-fetch rels.
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = tag.match(/\brel="([^"]*)"/i)?.[1]?.toLowerCase() ?? "";
    if (!/\b(stylesheet|icon)\b/.test(rel) || rel.includes("apple-touch-icon")) continue;
    const href = tag.match(/\bhref="([^"]*)"/i)?.[1];
    if (href) urls.add(href);
  }

  // <script src>
  for (const tag of html.match(/<script\b[^>]*\bsrc="([^"]*)"/gi) ?? []) {
    urls.add(tag.match(/\bsrc="([^"]*)"/i)[1]);
  }

  // <img src> and every srcset candidate (worst case: browser picks any one;
  // counting all overstates, so count src plus the largest srcset entry).
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = tag.match(/\bsrc="([^"]*)"/i)?.[1];
    if (src) urls.add(src);
    const srcset = tag.match(/\bsrcset="([^"]*)"/i)?.[1];
    if (srcset) {
      const candidates = srcset
        .split(",")
        .map((c) => c.trim().split(/\s+/)[0])
        .filter(Boolean);
      for (const c of candidates) urls.add(c);
    }
  }

  // Browsers request /favicon.ico regardless of markup.
  urls.add("/favicon.ico");

  // Local files only — external URLs aren't part of this site's budget.
  return [...urls].filter((u) => u.startsWith("/") && !u.startsWith("//"));
}

function main() {
  const budget = parseBudget(process.argv.slice(2));
  const indexPath = join(DIST_DIR, "index.html");

  if (!existsSync(indexPath)) {
    fail(`${indexPath} not found — run 'npm run build' first.`);
  }

  const html = readFileSync(indexPath, "utf8");
  const entries = [{ url: "/index.html", bytes: Buffer.byteLength(html) }];

  for (const url of collectAssetUrls(html)) {
    const filePath = join(DIST_DIR, url.split(/[?#]/)[0]);
    if (!existsSync(filePath)) {
      fail(`Asset referenced by index.html is missing from dist/: ${url}`);
    }
    entries.push({ url, bytes: statSync(filePath).size });
  }

  entries.sort((a, b) => b.bytes - a.bytes);
  const total = entries.reduce((sum, e) => sum + e.bytes, 0);

  console.log("Homepage first-load weight (uncompressed, from dist/):\n");
  for (const { url, bytes } of entries) {
    console.log(`  ${formatKiB(bytes).padStart(10)}  ${url}`);
  }
  console.log(`\n  Total:  ${formatKiB(total)} (${total} bytes)`);
  console.log(`  Budget: ${formatKiB(budget)} (${budget} bytes)`);

  if (total > budget) {
    console.error(`\n❌ Over budget by ${formatKiB(total - budget)}.`);
    console.error("   Reduce homepage weight or, if the growth is deliberate,");
    console.error("   raise DEFAULT_BUDGET_BYTES in scripts/check-size.mjs.");
    process.exit(1);
  }
  console.log(`\n✅ Within budget (${formatKiB(budget - total)} headroom).`);
}

main();
