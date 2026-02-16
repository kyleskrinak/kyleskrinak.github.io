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
In CI or Linux environments without a display server, the scripts auto-fallback to headless.

To force headless mode (CI/CD friendly, but more likely to hit bot detection):

```bash
PLAYWRIGHT_HEADED=false npm run check:links
```

To force headed mode (override auto-detection):

```bash
PLAYWRIGHT_HEADED=true npm run check:links
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

### Available Commands

**Two-Tier Check (Recommended):**

```bash
npm run check:links  # Automated: htmltest + Playwright browser verification
```

**Individual Tools:**

```bash
npm run htmltest           # Tier 1 only: Fast HTTP checks
npm run test:links         # Playwright page tests (internal link validation)
npm run htmltest:verbose   # htmltest with detailed output
```

**Note:** `test:links` is Playwright-based page validation (different from htmltest).
Use `check:links` for comprehensive external link verification.

### Manual Tier 1 Check

```bash
npm run build
npm run htmltest
```

This runs only Tier 1 (htmltest) against the built site. It checks:

- Internal links
- External links
- Canonical URLs
- Hash anchors

**Important:** This may report false positives from bot detection. Use `check:links` instead for accurate results.

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
  - "onedrive.live.com"  # Bot detection, works in real browsers
  - "nytimes.com"        # Aggressive rate limiting, works in real browsers
  - "windowsupdate.microsoft.com"  # Windows Update client endpoint, not web-accessible
  # ... etc
```

**Note**: 403 responses and connection/TLS errors are automatically withheld (not suggested for IgnoreURLs).

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
- ✅ URL fails automated checks **BUT has explicit status code** (404, 429, 503, etc.)
- ✅ Site is legitimate and trustworthy
- ✅ Content is still valuable to readers
- ⚠️  **Never add** 403 responses (withheld by policy), connection errors, or URLs that also fail in browser

Do NOT add to ignore list when:
- ❌ URL fails browser verification (genuinely broken - timeout, TLS error, connection refused, etc.)
- ❌ Content has moved to new URL
- ❌ Site is permanently offline
- ⚠️  **Policy Exclusions**: 
  - 403 responses: withheld by policy (not added even if browser works)
  - Connection/TLS errors (no status code): not suggested (real issues to investigate)
  - 404 in both htmltest and browser: genuinely broken (don't ignore)

## Bot-Blocking Patterns

Sites may report different errors to bots vs real browsers:

| Pattern | htmltest Reports | Browser Returns | Action |
|---------|------------------|-----------------|--------|
| **Aggressive bot detection** | 403 | 200 OK | Withheld by policy (403s never added) |
| **Softer bot detection** | 404 | 200 OK | May add to ignore list (script suggests) |
| **Rate limiting** | 429 | 200 OK | May add to ignore list |
| **Genuinely broken** | 404 | 404 | Do NOT add (link needs fixing) |
| **Proxy issues** | 503 | 200 OK | May add to ignore list |

**Key Rule**: Only add to ignore list if the URL **works in browser verification**. If browser also fails, the link is genuinely broken and should be fixed, not ignored.

| Domain | Reason |
|--------|--------|
| `nytimes.com` | Aggressive bot detection (rate limiting) |
| `linkedin.com` | Returns 999 status to block scrapers |
| `onedrive.live.com` | Bot-blocking (works fine in real browser) |
| `microsoft.com/store` | Bot detection |
| Government sites (`.gov`) | Often block automated tools for security |

## Automated Checks (GitHub Actions)

### Nightly Link Monitoring

The repository runs automated link checks every night via GitHub Actions:

**Workflow:** `.github/workflows/linkwatch.yml`
**Schedule:** Daily at 6:23 AM UTC
**Process:**
1. Builds the site
2. Installs htmltest and Playwright Chromium
3. Runs `check:links` (two-tier verification)
4. Creates/updates GitHub issue if broken links found

**Issue Reporting:**
- **Title:** "Link check failure report"
- **Trigger:** Only genuinely broken links (failed both htmltest AND browser)
- **Auto-filtered:** 403s that work in browser are NOT reported
- **Action:** Review issue, fix broken links, update ignore list as suggested

**View workflow runs:**
```bash
gh workflow view linkwatch.yml
gh run list --workflow=linkwatch.yml --limit 5
```

**Manual trigger:**
```bash
gh workflow run linkwatch.yml
```

The automated workflow uses headless Chromium mode for CI compatibility while maintaining full bot-detection bypass capabilities.

## Maintenance

- Review ignore list quarterly
- Remove domains if sites change their bot policies
- Update this documentation when process changes
- Keep `.htmltest.yml` comments up to date with reasons
- Monitor nightly workflow runs for patterns in failures

## Troubleshooting

### htmltest shows false positives

Run browser verification. If URL works, add to ignore list.

### Browser verification times out

Increase timeout in `scripts/lib/verify-url.js` (default: 30s).

### Too many link errors after migration

Batch verify all external links, update systematically.

### Link works sometimes, fails other times

Intermittent failures suggest rate limiting. Add to ignore list if consistently works in browsers.
