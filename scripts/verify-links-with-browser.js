#!/usr/bin/env node
/**
 * Two-tier link verification process
 *
 * Usage:
 *   node scripts/verify-links-with-browser.js [url1] [url2] ...
 *
 * This script uses Playwright to verify URLs that failed htmltest checks.
 * It launches a real Chromium browser to handle JavaScript redirects,
 * bot detection, and other scenarios that simple HTTP requests can't handle.
 */

import { chromium } from 'playwright';

const urls = process.argv.slice(2);

if (urls.length === 0) {
  console.error('Usage: node scripts/verify-links-with-browser.js <url1> [url2] ...');
  process.exit(1);
}

async function verifyUrl(page, url) {
  try {
    const response = await page.goto(url, {
      waitUntil: 'load',
      timeout: 30000
    });

    const status = response ? response.status() : 'NO_RESPONSE';

    return {
      url,
      status,
      finalUrl: page.url(),
      redirected: page.url() !== url,
      success: response && response.ok()
    };
  } catch (error) {
    return {
      url,
      error: error.message,
      errorName: error.name,
      success: false
    };
  }
}

console.log('🔍 Launching real Chromium browser to verify URLs...\n');

const browser = await chromium.launch({ headless: false });
const results = [];

for (const url of urls) {
  console.log(`Checking: ${url}`);

  // Use fresh context for each URL to avoid navigation conflicts
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  const result = await verifyUrl(page, url);
  results.push(result);

  if (result.success) {
    console.log(`✅ ${result.status} - SUCCESS`);
    if (result.redirected) {
      console.log(`   → Redirected to: ${result.finalUrl}`);
    }
  } else {
    console.log(`❌ FAILED`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  console.log('');

  await context.close();
}

await browser.close();

// Summary
console.log('\n📊 SUMMARY');
console.log('='.repeat(60));

const working = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

console.log(`✅ Working: ${working.length}`);
working.forEach(r => {
  console.log(`   - ${r.url}`);
});

if (failed.length > 0) {
  console.log(`\n❌ Still failing in real browser: ${failed.length}`);
  console.log('\nFailed URLs (do NOT add these to IgnoreURLs; they appear to be genuinely broken):');
  failed.forEach(r => {
    console.log(`   - ${r.url}`);
    if (r.error) {
      console.log(`     Reason: ${r.error}`);
    }
  });
  console.log('\nSuggested actions:');
  console.log('  1. Check if content moved (try Web Archive)');
  console.log('  2. Update link to new location');
  console.log('  3. Add explanatory note if permanently offline');
  console.log('  4. Remove link if no longer valuable');
}

console.log('');
process.exit(failed.length > 0 ? 1 : 0);
