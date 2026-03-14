#!/usr/bin/env node
/**
 * Automated two-tier link checking process
 *
 * Usage:
 *   npm run check:links                    # Full site check (htmltest + browser)
 *   node scripts/check-links.js <url> ...  # Manual URL verification
 *
 * Process (full site check):
 * 1. Run htmltest (fast automated checks)
 * 2. Extract failed URLs
 * 3. Verify failures with real browser (Playwright)
 * 4. Report results and suggest ignore list updates
 *
 * Process (manual URLs):
 * 1. Verify provided URLs with real browser (Playwright)
 * 2. Report results
 */

import { execSync } from 'child_process';
import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { verifyUrl } from './lib/verify-url.js';
import { resolveBrowserMode } from './lib/browser-mode.js';

const DIST_DIR = 'dist';

// Check if URLs provided as command-line arguments
const manualUrls = process.argv.slice(2).filter(arg => {
  // Filter out flags and invalid arguments
  if (arg.startsWith('--') || arg.startsWith('-')) {
    console.error(`❌ Error: Invalid argument "${arg}"`);
    console.error('   Usage: node scripts/check-links.js <url> [<url> ...]');
    console.error('   Example: node scripts/check-links.js https://example.com\n');
    process.exit(1);
  }
  // Basic URL validation
  if (!arg.match(/^https?:\/\//)) {
    console.error(`❌ Error: Invalid URL "${arg}"`);
    console.error('   URLs must start with http:// or https://\n');
    process.exit(1);
  }
  return true;
});
const isManualMode = manualUrls.length > 0;

// Manual mode: skip htmltest, verify provided URLs directly
if (isManualMode) {
  console.log(`🔍 Manual URL verification mode (${manualUrls.length} URL${manualUrls.length === 1 ? '' : 's'})\n`);
} else {
  // Full site check mode: run htmltest first
  // Check if dist exists
  if (!existsSync(DIST_DIR)) {
    console.error('❌ Error: dist/ directory not found.');
    console.error('   Run "npm run build" first.\n');
    process.exit(1);
  }

  // Check if htmltest is installed
  try {
    execSync('htmltest --version', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Error: htmltest binary not found.');
    console.error('   Install htmltest first. See docs/link-checking.md for instructions.');
    console.error('   macOS: brew install htmltest');
    console.error('   Linux: https://github.com/wjdp/htmltest/releases\n');
    process.exit(1);
  }

  console.log('🔍 Starting automated two-tier link checking...\n');
  console.log('━'.repeat(60));
  console.log('TIER 1: htmltest (fast HTTP checks)');
  console.log('━'.repeat(60));
}

// Run htmltest and capture output (skip in manual mode)
let htmltestOutput = '';
let statusByUrl = new Map();
let failedUrls = [];

if (!isManualMode) {
  try {
    htmltestOutput = execSync('htmltest', {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log('✅ All links passed htmltest!\n');
    process.exit(0);
  } catch (error) {
    // Safely convert stdout/stderr to strings (defensive against buffers/undefined)
    const stdout = error && error.stdout != null
      ? (Buffer.isBuffer(error.stdout) ? error.stdout.toString('utf-8') : String(error.stdout))
      : '';
    const stderr = error && error.stderr != null
      ? (Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf-8') : String(error.stderr))
      : '';
    htmltestOutput = stdout + stderr;
  }

  console.log(htmltestOutput);

  // Extract failed URLs from htmltest output
  const urlPattern = /https?:\/\/[^\s]+/g;
  const failedLines = htmltestOutput.split('\n').filter(line =>
    line.includes('Non-OK status') ||
    line.includes('Get "http') ||
    line.includes('tls:')
  );

/**
 * Get canonical URL for deduplication purposes
 * Share buttons with different query params are treated as the same URL
 */
function getCanonicalUrl(url) {
  try {
    const urlObj = new URL(url);
    // Share services - only check base URL once regardless of shared content
    const shareServices = [
      'wa.me',
      'facebook.com/sharer.php',
      'x.com/intent',
      'twitter.com/intent',
      'pinterest.com/pin',
      't.me/share'
    ];

    const isShareService = shareServices.some(service => {
      const [serviceHost, ...servicePathParts] = service.split('/');
      const servicePath = servicePathParts.length ? '/' + servicePathParts.join('/') : '';
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;

      const hostnameMatches =
        hostname === serviceHost ||
        hostname.endsWith('.' + serviceHost);

      const pathMatches =
        servicePath === '' ? true : pathname.startsWith(servicePath);

      return hostnameMatches && pathMatches;
    });

    if (isShareService) {
      // Return base URL without query params for share services
      return urlObj.origin + urlObj.pathname;
    }

    // For other URLs, return as-is
    return url;
  } catch {
    return url;
  }
}

  const allUrls = [];

  failedLines.forEach(line => {
    const matches = line.match(urlPattern);
    if (!matches) return;

    // Clean trailing punctuation from htmltest output (quotes, colons, etc.)
    let url = matches[matches.length - 1];
    url = url.replace(/["':)\]]+$/, '');

    const statusMatch = line.match(/Non-OK status:\s*(\d{3})/);
    const newStatus = statusMatch ? Number(statusMatch[1]) : null;
    const existingStatus = statusByUrl.has(url) ? statusByUrl.get(url) : undefined;

    // Set status if first encounter, or overwrite null with actual status code
    if (!statusByUrl.has(url) || (existingStatus == null && newStatus != null)) {
      statusByUrl.set(url, newStatus);
    }

    allUrls.push(url);
  });

  // Deduplicate URLs intelligently using canonical form
  // Select representative URL with best known status for accurate reporting
  const canonicalToRepUrl = new Map();

  for (const url of allUrls) {
    const canonical = getCanonicalUrl(url);
    const currentStatus = statusByUrl.get(url);

    if (!canonicalToRepUrl.has(canonical)) {
      // First time we see this canonical URL: tentatively use this URL
      canonicalToRepUrl.set(canonical, url);
    } else {
      const existingUrl = canonicalToRepUrl.get(canonical);
      const existingStatus = statusByUrl.get(existingUrl);

      // Prefer a URL that has a concrete status over one with null/undefined
      if ((existingStatus == null) && (currentStatus != null)) {
        canonicalToRepUrl.set(canonical, url);
      }
    }
  }

  for (const repUrl of canonicalToRepUrl.values()) {
    failedUrls.push(repUrl);
  }

  const totalFailures = allUrls.length;
  const uniqueUrls = failedUrls.length;
  const skippedCount = totalFailures - uniqueUrls;

  if (skippedCount > 0) {
    console.log(`\nℹ️  Skipped ${skippedCount} duplicate URL(s) after canonicalization/deduplication\n`);
  }

  if (uniqueUrls === 0) {
    console.error('\n❌ htmltest reported errors, but no external URLs were found to verify.');
    console.error('   Failing check: please review the htmltest output above for internal link issues.\n');
    process.exit(1);
  }

  console.log('\n━'.repeat(60));
  console.log(`TIER 2: Browser verification (${uniqueUrls} unique URL${uniqueUrls === 1 ? '' : 's'})`);
  console.log('━'.repeat(60));
} else {
  // Manual mode: use provided URLs directly
  failedUrls = manualUrls;
  console.log('━'.repeat(60));
  console.log(`Verifying ${failedUrls.length} URL${failedUrls.length === 1 ? '' : 's'}`);
  console.log('━'.repeat(60));
}
// Browser mode:
// - Defaults to headed (better bot detection bypass)
// - PLAYWRIGHT_HEADED=true  -> force headed
// - PLAYWRIGHT_HEADED=false -> force headless
// - Otherwise auto-detect headless environments (CI, no display server on Linux)
const { headless } = resolveBrowserMode();

// HTTPS error handling: Defaults to strict TLS validation (catches cert issues)
// Set PLAYWRIGHT_IGNORE_HTTPS_ERRORS=true to bypass (useful for bot-detection testing)
const ignoreHTTPSErrors = process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === 'true';

const urlDescription = isManualMode ? 'URLs' : 'failed URLs';
console.log(`Launching Chromium in ${headless ? 'headless' : 'headed'} mode to verify ${urlDescription}...\n`);
if (!headless) {
  console.log('⚠️  Browser windows will open during verification.\n');
}
if (ignoreHTTPSErrors) {
  console.log('⚠️  HTTPS certificate validation disabled (PLAYWRIGHT_IGNORE_HTTPS_ERRORS=true)\n');
}

// Run browser verification
const browser = await chromium.launch({ headless });
const results = [];

try {
  for (const url of failedUrls) {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ignoreHTTPSErrors
    });
    const page = await context.newPage();

    console.log(`Checking: ${url}`);
    const result = await verifyUrl(page, url);
    results.push(result);

    if (result.success) {
      console.log(`  ✅ ${result.status} - Works in browser`);
      if (result.redirected) {
        console.log(`  → Redirects to: ${result.finalUrl}`);
      }
    } else {
      console.log(`  ❌ Failed in browser`);
      if (result.error) {
        console.log(`  → ${result.error}`);
      }
    }

    await context.close();
  }
} finally {
  await browser.close();
}

// Generate report
console.log('\n━'.repeat(60));
console.log('FINAL REPORT');
console.log('━'.repeat(60));

const working = results.filter(r => r.success);
const broken = results.filter(r => !r.success);

console.log(`\n📊 Summary:`);
if (isManualMode) {
  console.log(`   URLs checked: ${failedUrls.length}`);
  console.log(`   ✅ Working: ${working.length}`);
  console.log(`   ❌ Broken: ${broken.length}`);
} else {
  console.log(`   Unique URLs from htmltest: ${failedUrls.length}`);
  console.log(`   ✅ Working in real browser: ${working.length}`);
  console.log(`   ❌ Actually broken: ${broken.length}`);
}

// In automated mode, categorize working URLs by their htmltest status for detailed reporting
// Manual mode doesn't have htmltest status, so skip this categorization
let ignoreCandidates = [];
let withheld403s = [];
let connectionErrors = [];

if (!isManualMode) {
  // Compute candidates in outer scope for use throughout reporting and exit logic
  // Include: URLs with explicit HTTP status (404, 429, 503, etc.) suggesting bot-blocking
  // Exclude: 403s (withheld by policy), null/undefined (TLS/connection errors)
  ignoreCandidates = working.filter(r => {
    const status = statusByUrl.get(r.url);
    return status !== 403 && status !== null && status !== undefined;
  });
  withheld403s = working.filter(r => statusByUrl.get(r.url) === 403);
  connectionErrors = working.filter(r => statusByUrl.get(r.url) === null || statusByUrl.get(r.url) === undefined);
}

if (working.length > 0 && !isManualMode) {

  if (ignoreCandidates.length > 0) {
    console.log('\n✅ URLs that work in browser (add to .htmltest.yml IgnoreURLs):');
    console.log('━'.repeat(60));

    const domains = [...new Set(ignoreCandidates.map(r => {
      try {
        const url = new URL(r.url);
        return url.hostname;
      } catch {
        return r.url;
      }
    }))];

    domains.forEach(domain => {
      console.log(`  - "${domain}"`);
    });

    console.log('\nFull URLs:');
    ignoreCandidates.forEach(r => {
      console.log(`  - ${r.url}`);
      if (r.redirected) {
        console.log(`    → Redirects to: ${r.finalUrl}`);
      }
    });
  }

  if (withheld403s.length > 0) {
    console.log('\nℹ️  URLs that work in browser but returned 403 in htmltest (not adding to IgnoreURLs):');
    console.log('━'.repeat(60));
    withheld403s.forEach(r => {
      console.log(`  - ${r.url}`);
      if (r.redirected) {
        console.log(`    → Redirects to: ${r.finalUrl}`);
      }
    });
  }

  if (connectionErrors.length > 0) {
    console.log('\n⚠️  URLs that work in browser but had connection/TLS errors in htmltest (investigate):');
    console.log('━'.repeat(60));
    connectionErrors.forEach(r => {
      console.log(`  - ${r.url}`);
      if (r.redirected) {
        console.log(`    → Redirects to: ${r.finalUrl}`);
      }
    });
  }
}

if (broken.length > 0) {
  console.log('\n❌ URLs that are actually broken (need manual fixes):');
  console.log('━'.repeat(60));
  broken.forEach(r => {
    console.log(`  - ${r.url}`);
    if (r.error) {
      console.log(`    Reason: ${r.error}`);
    }
  });

  console.log('\nSuggested actions:');
  console.log('  1. Check if content moved (try Web Archive)');
  console.log('  2. Update link to new location');
  console.log('  3. Add explanatory note if permanently offline');
  console.log('  4. Remove link if no longer valuable');
}

console.log('\n' + '━'.repeat(60));

// Exit with appropriate code
// Note: 403s that work in browser are withheld from ignore list by policy, but still represent
// successful links (not broken), so they don't trigger exit(1). Only genuinely broken links fail.
if (broken.length > 0) {
  console.log(`\n⚠️  ${broken.length} link(s) need manual attention\n`);
  process.exit(1);
}

if (isManualMode && working.length > 0) {
  console.log(`\n✅ All provided URLs are accessible\n`);
} else if (ignoreCandidates.length > 0) {
  console.log(`\n✅ All failed links work in browser - update ignore list\n`);
} else if (working.length > 0) {
  console.log(`\n✅ All failed links work in browser - no ignore list updates suggested\n`);
}

process.exit(0);
