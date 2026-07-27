#!/usr/bin/env node
/**
 * Homepage weight gate.
 *
 * Sums the uncompressed bytes a browser fetches on a cold load of the built
 * homepage (dist/index.html plus every local asset it references: stylesheets,
 * scripts, icons, images, preload/modulepreload/manifest links, <picture>
 * sources, and CSS url() sub-resources one level deep, plus the implicit
 * /favicon.ico request) and fails when the total exceeds the budget. Mirrors
 * how 512kb.club / GTmetrix measure page weight; apple-touch-icon links are
 * excluded because desktop browsers do not fetch them on page load.
 * External (cross-origin) resources are excluded from the budget but
 * reported with a warning so third-party weight growth stays visible. CSS is
 * scanned one level deep only — @import chains are not followed. All icon
 * `rel` variants and site.webmanifest are counted even though a real browser
 * only fetches one icon and doesn't fetch the manifest on a normal page load —
 * this is deliberate worst-case accounting, not a bug.
 *
 * Usage:
 *   node scripts/check-size.mjs [--budget=<bytes>]
 *
 * Requires a current build (npm run build). Exit codes:
 *   0 = within budget, 1 = over budget, 2 = usage/environment/missing-asset error.
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

function distPathFor(url) {
  const pathname = url.split(/[?#]/)[0];
  try {
    return join(DIST_DIR, decodeURIComponent(pathname));
  } catch {
    fail(`Malformed URL encoding in asset path: ${pathname}`);
  }
}

function fileBytes(url) {
  const p = distPathFor(url);
  if (!existsSync(p)) return null;
  const stat = statSync(p);
  return stat.isFile() ? stat.size : null;
}

function parseBudget(argv) {
  const arg = argv.find((a) => a.startsWith("--budget="));
  if (!arg) return DEFAULT_BUDGET_BYTES;
  const raw = arg.slice("--budget=".length);
  const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(value) || value <= 0) {
    fail(`Invalid --budget value: ${raw} (expected a positive integer of bytes)`);
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
// A candidate is local (in-budget) if it's an absolute path; skip external
// URLs and data: URIs outright, and flag anything else (bare relative paths)
// as a potential undercount for the caller to warn about.
function isLocalAbsolute(u) {
  return u.startsWith("/") && !u.startsWith("//");
}

function isExternalOrData(u) {
  return /^(?:https?:)?\/\//i.test(u) || u.startsWith("data:");
}

// Browser fetches exactly one srcset candidate; count the largest as worst case.
function addLargestSrcsetCandidate(urls, srcset, skippedRelative, external) {
  const allCandidates = srcset
    .split(",")
    .map((c) => c.trim().split(/\s+/)[0])
    .filter(Boolean);
  const candidates = allCandidates.filter(isLocalAbsolute);
  for (const c of allCandidates) {
    if (isLocalAbsolute(c)) continue;
    if (isExternalOrData(c)) {
      if (!c.startsWith("data:")) external.add(c);
    } else {
      skippedRelative.push(c);
    }
  }

  let largest = null;
  let largestBytes = -1;
  for (const c of candidates) {
    const bytes = fileBytes(c);
    if (bytes === null) {
      fail(`Asset required for homepage load is missing from dist/: ${c}`);
    }
    if (bytes > largestBytes) {
      largest = c;
      largestBytes = bytes;
    }
  }
  if (largest) urls.add(largest);
}

function collectAssetUrls(html) {
  const urls = new Set();
  const skippedRelative = [];
  const external = new Set();

  // <link> tags: stylesheets, favicons, preload/modulepreload, manifest;
  // skip apple-touch-icon and non-fetch rels.
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = tag.match(/\brel="([^"]*)"/i)?.[1]?.toLowerCase() ?? "";
    if (!/\b(stylesheet|icon|preload|modulepreload|manifest)\b/.test(rel) || rel.includes("apple-touch-icon"))
      continue;
    const href = tag.match(/\bhref="([^"]*)"/i)?.[1];
    if (href) urls.add(href);
  }

  // <script src>
  for (const tag of html.match(/<script\b[^>]*\bsrc="([^"]*)"/gi) ?? []) {
    urls.add(tag.match(/\bsrc="([^"]*)"/i)[1]);
  }

  // <img>: browser fetches exactly one candidate, so only count srcset when
  // present; otherwise fall back to src.
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const srcset = tag.match(/\bsrcset="([^"]*)"/i)?.[1];
    if (srcset) {
      addLargestSrcsetCandidate(urls, srcset, skippedRelative, external);
    } else {
      const src = tag.match(/\bsrc="([^"]*)"/i)?.[1];
      if (src) urls.add(src);
    }
  }

  // <source src|srcset> (picture/video) — same one-candidate rule as <img>.
  for (const tag of html.match(/<source\b[^>]*>/gi) ?? []) {
    const srcset = tag.match(/\bsrcset="([^"]*)"/i)?.[1];
    if (srcset) {
      addLargestSrcsetCandidate(urls, srcset, skippedRelative, external);
    } else {
      const src = tag.match(/\bsrc="([^"]*)"/i)?.[1];
      if (src) urls.add(src);
    }
  }

  // Inline <style> blocks (Astro inlineStylesheets) — same url() scan as CSS files.
  for (const block of html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []) {
    for (const match of block.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      const ref = match[1];
      if (isLocalAbsolute(ref)) {
        urls.add(ref);
      } else if (isExternalOrData(ref)) {
        if (!ref.startsWith("data:")) external.add(ref);
      } else {
        skippedRelative.push(ref);
      }
    }
  }

  // Browsers request /favicon.ico regardless of markup.
  urls.add("/favicon.ico");

  // Local files only — external URLs aren't part of this site's budget,
  // but are reported (not silently dropped) so third-party weight is visible.
  for (const u of urls) {
    if (isExternalOrData(u)) {
      if (!u.startsWith("data:")) external.add(u);
    } else if (!isLocalAbsolute(u)) {
      skippedRelative.push(u);
    }
  }
  const localUrls = [...urls].filter(isLocalAbsolute);

  // CSS sub-resources (one level deep, no @import chasing).
  for (const url of [...localUrls]) {
    if (!url.split(/[?#]/)[0].endsWith(".css")) continue;
    const cssPath = distPathFor(url);
    if (!existsSync(cssPath)) continue;
    const css = readFileSync(cssPath, "utf8");
    for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      const ref = match[1];
      if (isLocalAbsolute(ref)) {
        urls.add(ref);
        localUrls.push(ref);
      } else if (isExternalOrData(ref)) {
        if (!ref.startsWith("data:")) external.add(ref);
      } else {
        skippedRelative.push(ref);
      }
    }
  }

  // Astro's default base ('/') always emits absolute paths, so this should
  // never fire today — it's a tripwire for a future base-path change or
  // hand-written relative markup that would otherwise undercount silently.
  if (skippedRelative.length > 0) {
    console.warn(`⚠️  Skipped ${skippedRelative.length} non-absolute URL(s) not counted toward budget: ${[...new Set(skippedRelative)].join(", ")}`);
  }
  if (external.size > 0) {
    console.warn(`⚠️  ${external.size} external URL(s) not counted toward budget: ${[...external].join(", ")}`);
  }

  return [...new Set(localUrls)];
}

function main() {
  const budget = parseBudget(process.argv.slice(2));
  const indexPath = join(DIST_DIR, "index.html");

  if (!existsSync(indexPath)) {
    fail(`${indexPath} not found — run 'npm run build' first.`);
  }

  const html = readFileSync(indexPath, "utf8");
  const entries = [{ url: "/index.html", bytes: Buffer.byteLength(html) }];

  const assetUrls = collectAssetUrls(html);
  const hasLinkedCss = assetUrls.some((u) => u.split(/[?#]/)[0].endsWith(".css"));
  const hasInlineStyle = /<style\b[^>]*>[\s\S]*?\S[\s\S]*?<\/style>/i.test(html);
  if (!hasLinkedCss && !hasInlineStyle) {
    fail("No stylesheet (external or inline) found in index.html — scanner may be broken");
  }

  const seen = new Set();
  const uniqueUrls = assetUrls.filter((u) => {
    const key = u.split(/[?#]/)[0];
    if (key === "/index.html" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const url of uniqueUrls) {
    const bytes = fileBytes(url);
    if (bytes === null) {
      fail(`Asset required for homepage load is missing from dist/: ${url}`);
    }
    entries.push({ url, bytes });
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
