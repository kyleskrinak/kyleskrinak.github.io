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
import { parseHtmltestFailures } from './lib/parse-htmltest.js';

const DIST_DIR = 'dist';

// Domains that require authentication to verify.
// Unauthenticated browsers receive bot-detection errors or login-wall responses
// that are indistinguishable from genuine 404s — so failures are reported for
// manual review rather than failing CI.
const AUTH_REQUIRED_DOMAINS = ['linkedin.com'];
const isAuthRequiredDomain = url => {
  try {
    const { hostname } = new URL(url);
    return AUTH_REQUIRED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
};

// Validate and collect URLs from command-line arguments
const manualUrls = [];
for (const arg of process.argv.slice(2)) {
  // Reject flags
  if (arg.startsWith('--') || arg.startsWith('-')) {
    console.error(`❌ Error: Invalid argument "${arg}"`);
    console.error('   Usage: node scripts/check-links.js <url> [<url> ...]');
    console.error('   Example: node scripts/check-links.js https://example.com\n');
    process.exit(1);
  }
  // Validate URL format
  if (!arg.match(/^https?:\/\//)) {
    console.error(`❌ Error: Invalid URL "${arg}"`);
    console.error('   URLs must start with http:// or https://\n');
    process.exit(1);
  }
  manualUrls.push(arg);
}
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
  } catch {
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
let nonNetworkFailures = [];

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

  // Extract failed URLs from htmltest output. Parsing lives in lib/parse-htmltest.js
  // so it can be unit-tested without running htmltest or launching a browser.
  const parsed = parseHtmltestFailures(htmltestOutput);
  statusByUrl = parsed.statusByUrl;
  failedUrls = parsed.failedUrls;
  nonNetworkFailures = parsed.nonNetworkFailures;

  const totalFailures = parsed.totalFailures;
  const uniqueUrls = failedUrls.length;
  const skippedCount = parsed.skippedCount;

  if (skippedCount > 0) {
    console.log(`\nℹ️  Skipped ${skippedCount} duplicate URL(s) after canonicalization/deduplication\n`);
  }

  // Markup, accessibility and internal-reference failures are not something a
  // browser can adjudicate: the referenced image may well answer 200 while the
  // alt attribute is still missing. They fail the build on their own, so tier 2
  // can never turn them into a pass.
  if (nonNetworkFailures.length > 0) {
    console.error(`\n❌ ${nonNetworkFailures.length} failure(s) that browser verification cannot excuse:`);
    console.error('━'.repeat(60));
    nonNetworkFailures.forEach(line => console.error(`  ${line}`));
    console.error('\n   These are markup, accessibility or internal-reference errors.');
    console.error('   They fail the check regardless of the tier 2 results below.');
  }

  if (uniqueUrls === 0) {
    console.error('\n❌ htmltest reported errors, but no external URLs were found to verify.');
    console.error('   Failing check: please review the htmltest output above.\n');
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

    if (result.reachable) {
      console.log(`  ✅ ${result.status} - Reachable in browser`);
      if (result.redirected) {
        console.log(`  → Redirects to: ${result.finalUrl}`);
      }
    } else if (result.withheld) {
      const withheldMsg = result.status === 429
        ? 'Rate-limited / bot-gated'
        : 'Withheld (browser also gated; resource exists)';
      console.log(`  ℹ️  ${result.status} - ${withheldMsg}`);
      if (result.redirected) {
        console.log(`  → Redirects to: ${result.finalUrl}`);
      }
    } else if (result.temporary) {
      const temporaryMsg = result.maintenanceSignals && result.maintenanceSignals.length > 0
        ? 'Temporarily unavailable (maintenance page)'
        : 'Temporarily unavailable (server error)';
      console.log(`  ⏸️  ${result.status} - ${temporaryMsg}`);
      if (result.retryAfter) {
        console.log(`  → Retry-After: ${result.retryAfter}`);
      }
      if (result.redirected) {
        console.log(`  → Redirects to: ${result.finalUrl}`);
      }
    } else {
      // Print the status: a bare "Failed in browser" gives no way to tell link
      // rot (404) from a server-side or transport failure, which is what made
      // the GitHub 503s in issue #391 so hard to diagnose from the report
      // alone. The catch path in verifyUrl returns no status at all, so name
      // that case rather than printing "undefined".
      const brokenStatus = result.status === undefined ? 'no response' : result.status;
      console.log(`  ❌ ${brokenStatus} - Failed in browser`);
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

// notBrokenResults includes reachable (2xx), withheld (403/429/999), and
// temporary (any 5xx — the host answered but could not serve) URLs.
// kept as a single set for sectioning logic that doesn't care which flavor.
const notBrokenResults = results.filter(r => r.success);
const reachableResults = results.filter(r => r.reachable);
const withheldResults = results.filter(r => r.withheld);
const temporaryResults = results.filter(r => r.temporary);
const broken = results.filter(r => !r.success);

// HTTP 429 = rate-limited/bot-gated: both htmltest and browser were gated.
// Drawn from withheldResults (browser confirmed gated) so that any 429 URL where
// the browser found a genuine failure (404/500/TLS) stays in trulyBroken instead.
// (Only meaningful in automated mode where htmltest status codes are available.)
const htmltest429s = !isManualMode
  ? withheldResults.filter(r => statusByUrl.get(r.url) === 429)
  : [];
// Separate auth-required domains (e.g. LinkedIn) from genuinely broken links.
// Auth-required URLs are reported for manual review but do not fail CI.
// Classify by effective URL (prefer finalUrl to catch cases where a redirect
// lands on — or away from — an auth-required domain) and partition in one pass.
const unverifiable = [];
const trulyBroken = [];
for (const r of broken) {
  if (isAuthRequiredDomain(r.finalUrl || r.url)) {
    unverifiable.push(r);
  } else {
    trulyBroken.push(r);
  }
}

// Summary counts segmented by browser status so labels match actual bucket contents.
// withheld403_999: browser returned 403 or 999 (policy blocks, resource exists)
// withheld429:     browser returned 429 (rate-limited/bot-gated)
// Both are non-broken; kept separate because they have different operator meanings.
const withheld403_999Count = withheldResults.filter(r => r.status === 403 || r.status === 999).length;
const withheld429Count = withheldResults.filter(r => r.status === 429).length;

console.log(`\n📊 Summary:`);
if (isManualMode) {
  console.log(`   URLs checked: ${failedUrls.length}`);
  console.log(`   ✅ Reachable: ${reachableResults.length}`);
  console.log(`   ℹ️  Withheld (gated): ${withheldResults.length}`);
  console.log(`   ⏸️  Temporarily unavailable (5xx server error): ${temporaryResults.length}`);
  console.log(`   ❌ Broken: ${trulyBroken.length}`);
  if (unverifiable.length > 0) {
    console.log(`   ⚠️  Unverifiable (requires auth — manual review): ${unverifiable.length}`);
  }
} else {
  console.log(`   Unique URLs from htmltest: ${failedUrls.length}`);
  console.log(`   ✅ Reachable in real browser: ${reachableResults.length}`);
  console.log(`   ℹ️  Withheld (browser gated 403/999): ${withheld403_999Count}`);
  if (withheld429Count > 0) {
    console.log(`   🚫 Rate-limited / bot-gated (browser 429): ${withheld429Count}`);
  }
  console.log(`   ⏸️  Temporarily unavailable (5xx server error): ${temporaryResults.length}`);
  console.log(`   ❌ Actually broken: ${trulyBroken.length}`);
  if (unverifiable.length > 0) {
    console.log(`   ⚠️  Unverifiable (requires auth — manual review): ${unverifiable.length}`);
  }
}

// In automated mode, categorize non-broken URLs by their htmltest status for detailed reporting
// Manual mode doesn't have htmltest status, so skip this categorization
//
// Naming convention: arrays prefixed with `htmltest` are keyed on the htmltest
// status code; arrays prefixed with `browser` are keyed on the browser result.
// Mixing the two created a reporting gap (Copilot, PR #105 round 4) where a
// browser-withheld URL whose htmltest status was non-policy (e.g., 404) would
// be counted in the summary but appear in no detail section.
let ignoreCandidates = [];
let htmltest403s = [];
let htmltest999s = [];
let htmltest5xxTemporaries = [];
let browserWithheldOther = [];
let browserTemporaryOther = [];
let connectionErrors = [];

if (!isManualMode) {
  // Compute candidates in outer scope for use throughout reporting and exit logic
  // Include: URLs the browser actually reached (HTTP 2xx) AND whose htmltest
  //   failure had an explicit non-policy status (404, 429, 503, etc.)
  // Exclude:
  //   - browser-withheld URLs (403/429/999) — gated against automation, not safe
  //     to auto-suggest as a permanent ignore even if htmltest's status differs
  //   - htmltest 403/999 — withheld by policy regardless of browser outcome
  //   - htmltest null/undefined — TLS/connection errors, kept visible for investigation
  //   - auth-required domains (e.g. linkedin.com) — policy says never add these to
  //     IgnoreURLs; use the unverifiable category instead (PR #121)
  ignoreCandidates = reachableResults.filter(r => {
    const status = statusByUrl.get(r.url);
    return status !== 403 && status !== 999 && status !== null && status !== undefined
      && !isAuthRequiredDomain(r.finalUrl || r.url);
  });
  htmltest403s = notBrokenResults.filter(r => statusByUrl.get(r.url) === 403 && !r.temporary);
  htmltest999s = notBrokenResults.filter(r => statusByUrl.get(r.url) === 999 && !r.temporary);
  // Any 5xx, not only 503: hosts shed load with whatever code they favour
  // (500, 502, 503, 504) and all of them mean the same thing here.
  htmltest5xxTemporaries = temporaryResults.filter(r => {
    const status = statusByUrl.get(r.url);
    return typeof status === 'number' && status >= 500 && status <= 599;
  });
  connectionErrors = notBrokenResults.filter(r => statusByUrl.get(r.url) === null || statusByUrl.get(r.url) === undefined);
  // Catch browser-withheld URLs whose htmltest status doesn't match any policy
  // bucket above, so every URL counted in the withheld summary appears in some
  // detail section. Exclude 429 — those are already covered by htmltest429s,
  // and including them here would produce duplicate detail output.
  browserWithheldOther = withheldResults.filter(r => {
    const status = statusByUrl.get(r.url);
    return status !== 403 && status !== 429 && status !== 999 && status !== null && status !== undefined;
  });
  browserTemporaryOther = temporaryResults.filter(r => {
    const status = statusByUrl.get(r.url);
    if (status === null || status === undefined) return false;
    return !(typeof status === 'number' && status >= 500 && status <= 599);
  });
}

if (notBrokenResults.length > 0 && !isManualMode) {

  if (ignoreCandidates.length > 0) {
    console.log('\n✅ URLs reachable in browser — no action needed (two-tier verification confirmed these):');
    console.log('━'.repeat(60));
    ignoreCandidates.forEach(r => {
      console.log(`  - ${r.url}`);
      if (r.redirected) {
        console.log(`    → Redirects to: ${r.finalUrl}`);
      }
    });
    console.log('  ℹ️  If a URL above consistently fails htmltest on every run, you may add it to .htmltest.yml IgnoreURLs to skip the tier-2 check overhead. Not required — CI already passes without it.');
    console.log('     Tradeoff: IgnoreURLs also suppresses tier-1 checks for those URLs, so future regressions on them won\'t be caught. Keep the list minimal and revisit periodically.');
  }

  const formatWithheld = (r) => {
    const browserState = r.reachable
      ? `browser: ${r.status} reachable`
      : `browser: ${r.status} also gated`;
    return `  - ${r.url}  (${browserState})`;
  };

  if (htmltest403s.length > 0) {
    console.log('\nℹ️  htmltest reported 403 — withheld by policy (not added to IgnoreURLs):');
    console.log('━'.repeat(60));
    htmltest403s.forEach(r => {
      console.log(formatWithheld(r));
      if (r.redirected) {
        console.log(`    → Redirects to: ${r.finalUrl}`);
      }
    });
  }

  if (htmltest999s.length > 0) {
    console.log('\nℹ️  htmltest reported 999 — withheld by policy (not added to IgnoreURLs):');
    console.log('━'.repeat(60));
    htmltest999s.forEach(r => {
      console.log(formatWithheld(r));
      if (r.redirected) {
        console.log(`    → Redirects to: ${r.finalUrl}`);
      }
    });
  }

  if (htmltest5xxTemporaries.length > 0) {
    console.log('\nℹ️  htmltest reported 5xx — server error, treated as temporary (not added to IgnoreURLs):');
    console.log('━'.repeat(60));
    htmltest5xxTemporaries.forEach(r => {
      const htmltestStatus = statusByUrl.get(r.url);
      const browserDetail = r.maintenanceSignals && r.maintenanceSignals.length > 0
        ? `${r.status} maintenance page`
        : `${r.status} server error`;
      console.log(`  - ${r.url}  (htmltest: ${htmltestStatus}, browser: ${browserDetail})`);
      if (r.retryAfter) {
        console.log(`    → Retry-After: ${r.retryAfter}`);
      }
      if (r.redirected) {
        console.log(`    → Redirects to: ${r.finalUrl}`);
      }
    });
    console.log('  ℹ️  A 5xx means the host answered but could not serve the page — that is not link rot, so these do not fail the check.');
    console.log('     Watch for repeats: a URL listed here on several consecutive runs needs a manual look, because a permanent 5xx will never fail CI on its own.');
  }

  if (browserWithheldOther.length > 0) {
    console.log('\nℹ️  Browser was gated (403/429/999) — htmltest status outside dedicated policy buckets (not added to IgnoreURLs):');
    console.log('━'.repeat(60));
    browserWithheldOther.forEach(r => {
      const htmltestStatus = statusByUrl.get(r.url);
      console.log(`  - ${r.url}  (htmltest: ${htmltestStatus}, browser: ${r.status} gated)`);
      if (r.redirected) {
        console.log(`    → Redirects to: ${r.finalUrl}`);
      }
    });
  }

  if (browserTemporaryOther.length > 0) {
    console.log('\nℹ️  Browser returned a 5xx server error but htmltest reported a non-5xx status:');
    console.log('━'.repeat(60));
    browserTemporaryOther.forEach(r => {
      const htmltestStatus = statusByUrl.get(r.url);
      console.log(`  - ${r.url}  (htmltest: ${htmltestStatus}, browser: ${r.status} server error)`);
      if (r.retryAfter) {
        console.log(`    → Retry-After: ${r.retryAfter}`);
      }
      if (r.redirected) {
        console.log(`    → Redirects to: ${r.finalUrl}`);
      }
    });
  }

  if (connectionErrors.length > 0) {
    console.log('\n⚠️  htmltest had connection/TLS errors but browser got a response (investigate):');
    console.log('━'.repeat(60));
    connectionErrors.forEach(r => {
      const browserState = r.reachable
        ? `${r.status} reachable`
        : r.withheld
          ? `${r.status} gated`
          : `${r.status} server error`;
      console.log(`  - ${r.url}  (browser: ${browserState})`);
      if (r.redirected) {
        console.log(`    → Redirects to: ${r.finalUrl}`);
      }
    });
  }
}

// 429-gated URLs are reported outside the notBrokenResults guard because
// they are a subset of withheldResults and would duplicate that section's display.
if (!isManualMode && htmltest429s.length > 0) {
  console.log('\nℹ️  htmltest reported 429 — rate-limited / bot-gated (not added to IgnoreURLs):');
  console.log('━'.repeat(60));
  htmltest429s.forEach(r => {
    console.log(`  - ${r.url}`);
    if (r.error) {
      console.log(`    → ${r.error}`);
    }
  });
}

if (unverifiable.length > 0) {
  console.log('\n⚠️  URLs that could not be verified (require authentication — manual review):');
  console.log('━'.repeat(60));
  unverifiable.forEach(r => {
    console.log(`  - ${r.url}`);
    if (r.redirected) {
      console.log(`    → Redirects to: ${r.finalUrl}`);
    }
    // Prefer a thrown error message; otherwise fall back to the HTTP status
    // (which can be the literal string 'NO_RESPONSE' when the browser got
    // no response object — see scripts/lib/verify-url.js:20).
    if (r.error) {
      console.log(`    → ${r.error}`);
    } else if (r.status === 'NO_RESPONSE') {
      console.log(`    → No response from server`);
    } else if (r.status !== undefined) {
      console.log(`    → HTTP ${r.status}`);
    }
  });
  console.log('\n  Automated verification is unreliable for these domains.');
  console.log('  Check manually if you suspect a link may have changed.');
}

if (trulyBroken.length > 0) {
  console.log('\n❌ URLs that are actually broken (need manual fixes):');
  console.log('━'.repeat(60));
  trulyBroken.forEach(r => {
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
// Note: 403/429/999 withheld, 5xx server errors, and auth-required unverifiable
// URLs stay visible in the report but do not trigger exit(1).
// Only genuinely broken links fail.
if (trulyBroken.length > 0 || nonNetworkFailures.length > 0) {
  if (trulyBroken.length > 0) {
    console.log(`\n⚠️  ${trulyBroken.length} link(s) need manual attention`);
  }
  if (nonNetworkFailures.length > 0) {
    console.log(`⚠️  ${nonNetworkFailures.length} markup/accessibility failure(s) listed above`);
  }
  console.log('');
  process.exit(1);
}

if (unverifiable.length > 0) {
  if (isManualMode) {
    console.log(`\nℹ️  ${unverifiable.length} URL(s) could not be verified automatically (auth-required domain) — check manually.\n`);
  } else {
    console.log(`\n✅ No broken links found. ${unverifiable.length} URL(s) require manual verification (see above).\n`);
  }
} else if (isManualMode && notBrokenResults.length > 0) {
  console.log(`\n✅ All provided URLs are accounted for (reachable, withheld, or temporary)\n`);
} else if (notBrokenResults.length > 0) {
  console.log(`\n✅ All failed links accounted for (reachable, withheld, or temporary)\n`);
}

process.exit(0);
