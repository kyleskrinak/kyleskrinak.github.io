# Link Checking Process

This document describes the two-tier link verification process for the blog.

## Prerequisites

Before running link checks, you need:

### 1. htmltest Binary

htmltest is not an npm package - it's a standalone Go binary. Install it:

**macOS (Homebrew)**:
```bash
brew install htmltest
```

**Linux / macOS (manual)**:
```bash
# Download latest release
curl -sL https://github.com/wjdp/htmltest/releases/latest/download/htmltest_$(uname -s)_$(uname -m).tar.gz | tar -xz
sudo mv htmltest /usr/local/bin/
```

**Windows (manual)**:
Download from https://github.com/wjdp/htmltest/releases and add to PATH.

**Verify installation**:
```bash
htmltest --version
```

### 2. Playwright Browsers

The two-tier system uses Chromium for browser verification:

```bash
npx playwright install chromium
```

### 3. Browser Mode Configuration

By default, browser verification runs in **headed mode** (best for bot detection bypass).

To use headless mode (CI/CD friendly, but more likely to hit bot detection):

```bash
PLAYWRIGHT_HEADED=false npm run check:links
```

**Trade-offs**:
- ✅ **Headed (default)**: Better bot detection bypass, requires display
- ⚠️ **Headless (`PLAYWRIGHT_HEADED=false`)**: Works in CI/CD, Docker, SSH sessions without GUI

**When to use headless mode**:
- CI/CD pipelines and automated checks without display
- Server environments (Docker, SSH, remote machines)
- When you want faster execution without browser UI

### 4. HTTPS Certificate Validation

By default, browser verification uses **strict TLS validation** to catch certificate issues.

To bypass HTTPS errors (useful for testing bot-detected sites):

```bash
PLAYWRIGHT_IGNORE_HTTPS_ERRORS=true npm run check:links
```

**Trade-offs**:
- ✅ **Strict (default)**: Catches expired/invalid certificates, follows documented guidelines
- ⚠️ **Bypass (`PLAYWRIGHT_IGNORE_HTTPS_ERRORS=true`)**: Helps test bot-detected sites, but may miss cert issues

**When to use bypass**:
- Testing sites with known bot detection that also have cert warnings
- Verifying if a failure is due to TLS vs actual broken link
- Local troubleshooting of bot-detected sites

**Do NOT bypass for**:
- Regular link checking (use default strict validation)
- Sites that fail with actual cert errors (document as broken)

## Overview

We use a two-tier approach to verify external links:

1. **Tier 1: htmltest** - Fast, automated link checking via HTTP requests
2. **Tier 2: Playwright** - Real browser verification for links that fail htmltest

This approach minimizes false positives from bot detection while maintaining comprehensive link checking.

## Running Link Checks

### Automated Two-Tier Check (Recommended)

```bash
npm run build
npm run check:links
```

This automatically:
1. Runs htmltest (Tier 1 - fast HTTP checks)
2. Extracts failed URLs
3. Verifies failures with real browser (Tier 2 - Playwright)
4. Reports which URLs work and which are actually broken
5. Suggests ignore list updates

**Use this for regular link checking.**

**Optional Environment Variables:**

```bash
# Use headless mode (CI/CD friendly)
PLAYWRIGHT_HEADED=false npm run check:links

# Bypass HTTPS validation (for cert-warning sites)
PLAYWRIGHT_IGNORE_HTTPS_ERRORS=true npm run check:links

# Combine both
PLAYWRIGHT_HEADED=false PLAYWRIGHT_IGNORE_HTTPS_ERRORS=true npm run check:links
```

### Manual Checks

#### Standard Check (Tier 1 only)

```bash
npm run build
npm run test:links
```

This runs `htmltest` against the built site. It checks:
- Internal links
- External links
- Canonical URLs
- Hash anchors

### Configuration

Link checking is configured in `.htmltest.yml`:

```yaml
DirectoryPath: "dist"
CheckExternal: true
CheckInternal: true
IgnoreCanonicalBrokenLinks: false
IgnoreAltMissing: false
IgnoreDirectoryMissingTrailingSlash: true
IgnoreURLs:
  - "onedrive.live.com"  # Works in browsers, blocks bots
  - "nytimes.com"        # Works in browsers, blocks bots
  # ... etc
```

**Note**: 403 responses are automatically withheld from ignore suggestions by the link checker script (see Tier 2 browser verification).

## Handling Link Check Failures

When `npm run test:links` reports errors:

### Step 1: Identify Error Types

Common error types:
- **404 Not Found** - Content moved or deleted
- **403 Forbidden** - Bot blocking or access restrictions
- **TLS errors** - Certificate issues
- **Timeouts** - Slow or unavailable sites

### Step 2: Browser Verification (Tier 2)

For URLs that fail htmltest, verify them with a real browser:

```bash
node scripts/verify-links-with-browser.js \
  "https://example.com/url1" \
  "https://example.com/url2"
```

**Optional Environment Variables:**
```bash
# Use headless mode
PLAYWRIGHT_HEADED=false node scripts/verify-links-with-browser.js \
  "https://example.com/url"

# Bypass HTTPS validation
PLAYWRIGHT_IGNORE_HTTPS_ERRORS=true node scripts/verify-links-with-browser.js \
  "https://example.com/url"
```

This script:
- Launches Chromium browser (headed by default, headless with PLAYWRIGHT_HEADED=false)
- Handles JavaScript redirects
- Can bypass bot detection (better in headed mode)
- Reports final status and any redirects
- Uses strict TLS validation by default (set PLAYWRIGHT_IGNORE_HTTPS_ERRORS=true to bypass)

### Step 3: Take Action Based on Results

#### If Browser Verification Succeeds ✅

The URL works for real users but fails automated checks. Add domain to `.htmltest.yml` only if:
- The browser check succeeded (HTTP 200 or redirect)
- The htmltest failure was NOT a 403 response (403s are automatically withheld by the script)

```yaml
IgnoreURLs:
  - "example.com"  # Works in browsers, blocks bots (non-403 failure)
```

Do NOT add domains for permanent failures (404s, TLS certificate errors, timeout issues).

#### If Browser Verification Fails ❌

The URL is legitimately broken. Options:

1. **Update the link** if content moved (use Web Archive or search for new location)
2. **Add explanatory note** if site is permanently offline:
   ```markdown
   _Note: The original site has been decommissioned and content was never archived._
   ```
3. **Remove the link** if it no longer adds value
4. **Add to ignore list** if it's a known issue (e.g., `windowsupdate.microsoft.com` requires Windows Update client)

## Example Workflow

### Using Automated Check (Recommended)

```bash
# 1. Build and run automated check
npm run build
npm run check:links

# Output automatically:
# - Runs htmltest
# - Verifies failures with browser
# - Reports results with suggested actions:
#
# ✅ URLs that work in browser (add to .htmltest.yml IgnoreURLs):
#   - "example.com"
#
# ❌ URLs that are actually broken (need manual fixes):
#   - https://other.example.com/page
#     Reason: net::ERR_NAME_NOT_RESOLVED

# 2. Update .htmltest.yml with suggested domains
# 3. Fix broken links in content
# 4. Re-run check
npm run check:links
```

### Using Manual Process

```bash
# 1. Build and test
npm run build
npm run test:links

# Output shows 5 errors

# 2. Extract failed URLs from output and verify with browser
node scripts/verify-links-with-browser.js \
  "https://www.example.com/article" \
  "https://other.example.com/page"

# 3. Browser verification shows:
#    ✅ example.com - works (add to ignore list)
#    ❌ other.example.com - fails (update content)

# 4. Update .htmltest.yml
# 5. Fix broken link in content
# 6. Re-run test
npm run test:links
```

## Ignore List Guidelines

Add domains to `IgnoreURLs` when:
- ✅ URL works in real browsers (verified with browser)
- ✅ URL fails automated checks (e.g., bot detection, rate limiting)
- ✅ Site is legitimate and trustworthy
- ✅ Content is still valuable to readers
- ⚠️  **NOT if the failure is a 403** (403 responses are automatically withheld by the link checker)

Do NOT add to ignore list when:
- ❌ URL returns 403 (automatically handled by script withhold policy)
- ❌ URL returns 404 (content is gone)
- ❌ Site is permanently offline
- ❌ Content has moved to new URL
- ❌ TLS certificate is invalid/expired

## Common Ignore List Domains

| Domain | Reason |
|--------|--------|
| `nytimes.com` | Aggressive bot detection (rate limiting) |
| `linkedin.com` | Returns 999 status to block scrapers |
| `onedrive.live.com` | Bot-blocking (works fine in real browser) |
| `microsoft.com/store` | Bot detection |
| Government sites (`.gov`) | Often block automated tools for security |

## Maintenance

- Review ignore list quarterly
- Remove domains if sites change their bot policies
- Update this documentation when process changes
- Keep `.htmltest.yml` comments up to date with reasons

## Troubleshooting

### htmltest shows false positives

Run browser verification. If URL works, add to ignore list.

### Browser verification times out

Increase timeout in `scripts/lib/verify-url.js` (default: 30s).

### Too many link errors after migration

Batch verify all external links, update systematically.

### Link works sometimes, fails other times

Intermittent failures suggest rate limiting. Add to ignore list if consistently works in browsers.
