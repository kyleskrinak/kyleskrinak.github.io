# Testing Guide

This directory contains Playwright tests for the Astro blog. Tests are organized by type.

## Console Errors Check

**Purpose**: Verify no console errors or 404s appear when browsing key pages.

**When to run**: Before pushing to staging to catch issues early (404 resources, syntax errors, etc.)

### Running Locally (Against Dev Server)

```bash
# Terminal 1: Start the dev server
npm run dev

# Terminal 2: Run the test
npm run test:console
```

### Running Against Staging

```bash
npm run test:console:staging
```

This will test the live staging site on GitHub Pages and report any console errors.

### Running Against Production

```bash
npm run test:console:production
```

### What It Tests

✅ **Console Errors**: Catches JavaScript errors and warnings
✅ **404 Resources**: Detects failed resource loads (images, manifests, etc.)
✅ **Favicon Files**: Verifies all favicon variants are accessible
✅ **Key Pages**: Tests home, blog, search, about, and sample post

### Example Output

```
📄 Testing: Home (/)
   ✅ No console errors

📄 Testing: Blog (/blog/)
   ✅ No console errors

📄 Testing: Search (/search/)
   ❌ Found 1 console error(s):
      - [404] Failed to load: https://kyleskrinak.github.io/astro-blog/site.webmanifest

📊 CONSOLE ERROR SUMMARY
❌ 1 page(s) have console errors:

  📄 Search:
     • [404] Failed to load: https://kyleskrinak.github.io/astro-blog/site.webmanifest
```

## Analytics Privacy Signal Testing

**Purpose**: Verify that Cloudflare Web Analytics respects user privacy signals (Do Not Track and Global Privacy Control).

**When to run**: After making changes to analytics loading logic or before merging privacy-related features.

### Running Locally

```bash
# Terminal 1: Build and preview (analytics only loads in production builds)
npm run build && npm run preview

# Terminal 2: Run the test
npx playwright test tests/analytics-privacy.spec.ts
```

### What It Tests

✅ **No Privacy Signals**: Beacon loads when neither DNT nor GPC is set
✅ **DNT = "0"**: Beacon loads when user explicitly consents to tracking
✅ **DNT = "1"**: Beacon does NOT load when Do Not Track is enabled
✅ **DNT = "yes"**: Beacon does NOT load (alternative DNT value)
✅ **GPC = true**: Beacon does NOT load when Global Privacy Control is enabled
✅ **GPC = false**: Beacon loads when GPC is explicitly disabled
✅ **Both Enabled**: Beacon does NOT load when both signals are present

### Key Implementation Details

- Tests mock `navigator.doNotTrack` and `navigator.globalPrivacyControl` properties
- Uses deterministic waits (`waitForLoadState`) instead of fixed timeouts
- Validates presence/absence of the beacon script element in the DOM
- GPC has limited browser support (primarily Firefox and privacy-focused browsers)

## Visual Regression Testing

**Purpose**: Ensure UI hasn't changed unexpectedly across browser updates or code changes.

### Running Locally

```bash
npm run test:visual
```

### Updating Baselines

When you intentionally change the UI, update the baseline snapshots:

```bash
npm run test:visual:baseline
```

### Running Against Staging

```bash
npm run test:visual:staging
```

## Troubleshooting

### Test times out
- **Dev server**: Make sure `npm run dev` is running in another terminal
- **Staging/Production**: Check your internet connection

### Resource not found errors
- Run `npm run build:ci` first to ensure all assets are built
- Check that resources are correctly deployed

### False positives
- Some third-party scripts may log warnings that aren't critical
- Review the specific error messages in the output
- If they're safe to ignore, file them as "known issues"
