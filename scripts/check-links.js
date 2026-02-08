#!/usr/bin/env node
/**
 * Automated two-tier link checking process
 *
 * Usage: npm run check:links
 *
 * Process:
 * 1. Run htmltest (fast automated checks)
 * 2. Extract failed URLs
 * 3. Verify failures with real browser (Playwright)
 * 4. Report results and suggest ignore list updates
 */

import { execSync } from 'child_process';
import { chromium } from 'playwright';
import { existsSync } from 'fs';

const DIST_DIR = 'dist';

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

// Run htmltest and capture output
let htmltestOutput;

try {
  htmltestOutput = execSync('htmltest', {
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  console.log('✅ All links passed htmltest!\n');
  process.exit(0);
} catch (error) {
  htmltestOutput = error.stdout + error.stderr;
}

console.log(htmltestOutput);

// Extract failed URLs from htmltest output
const urlPattern = /https?:\/\/[^\s]+/g;
const failedLines = htmltestOutput.split('\n').filter(line =>
  line.includes('Non-OK status') ||
  line.includes('Get "http') ||
  line.includes('tls:')
);

const failedUrls = [...new Set(
  failedLines
    .map(line => {
      const matches = line.match(urlPattern);
      return matches ? matches[matches.length - 1] : null;
    })
    .filter(url => url !== null)
)];

if (failedUrls.length === 0) {
  console.error('\n❌ htmltest reported errors, but no external URLs were found to verify.');
  console.error('   Failing check: please review the htmltest output above for internal link issues.\n');
  process.exit(1);
}

console.log('\n━'.repeat(60));
console.log(`TIER 2: Browser verification (${failedUrls.length} URLs)`);
console.log('━'.repeat(60));
console.log('Launching Chromium in headed mode to verify failed URLs...\n');
console.log('⚠️  Browser windows will open during verification.\n');

// Browser verification function
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
      success: false
    };
  }
}

// Run browser verification (headed mode to avoid bot detection)
const browser = await chromium.launch({ headless: false });
const results = [];

for (const url of failedUrls) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true
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

await browser.close();

// Generate report
console.log('\n━'.repeat(60));
console.log('FINAL REPORT');
console.log('━'.repeat(60));

const working = results.filter(r => r.success);
const broken = results.filter(r => !r.success);

console.log(`\n📊 Summary:`);
console.log(`   Total failures from htmltest: ${failedUrls.length}`);
console.log(`   ✅ Working in real browser: ${working.length}`);
console.log(`   ❌ Actually broken: ${broken.length}`);

if (working.length > 0) {
  console.log('\n✅ URLs that work in browser (add to .htmltest.yml IgnoreURLs):');
  console.log('━'.repeat(60));

  const domains = [...new Set(working.map(r => {
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
  working.forEach(r => {
    console.log(`  - ${r.url}`);
    if (r.redirected) {
      console.log(`    → Redirects to: ${r.finalUrl}`);
    }
  });
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
if (broken.length > 0) {
  console.log(`\n⚠️  ${broken.length} link(s) need manual attention\n`);
  process.exit(1);
} else if (working.length > 0) {
  console.log(`\n✅ All failed links work in browser - update ignore list\n`);
  process.exit(0);
} else {
  process.exit(0);
}
