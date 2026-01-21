# Visual Regression Testing

Playwright-based visual regression tests to catch unintended changes in layout, styling, and responsive design across different environments (local, staging, production).

## Quick Start

### 1. Create Baseline Screenshots (First Time)
```bash
npm run test:visual:baseline
```
This generates reference screenshots in `tests/visual/__screenshots__/`. Commit these to version control.

### 2. Run Tests Against Local Dev
```bash
npm run test:visual
```
Compares current rendering against baselines. Local dev server starts automatically.

### 3. Test Staging Before Launch
```bash
npm run test:visual:staging
```
Tests against GitHub Pages staging URL. This validates that staging renders identically to local.

### 4. Verify Production After Launch
```bash
npm run test:visual:production
```
Tests against production URL. Should match staging and baselines.

## Available Commands

```bash
# Local dev (auto-starts dev server)
npm run test:visual

# Create/update baselines from local
npm run test:visual:baseline

# Test against staging (GitHub Pages)
npm run test:visual:staging

# Test against production (kyle.skrinak.com)
npm run test:visual:production

# View HTML report of last test run
npm run test:visual:report

# Or use the shell script directly
./scripts/visual-test.sh local              # Local dev
./scripts/visual-test.sh staging            # Staging
./scripts/visual-test.sh production         # Production
./scripts/visual-test.sh baseline           # Create baselines
./scripts/visual-test.sh compare            # View report
```

## What Gets Tested

### Pages
- ✓ Home page (desktop & mobile)
- ✓ Blog archive
- ✓ Individual blog posts (multiple examples)
- ✓ Tag pages
- ✓ Category archive
- ✓ About page
- ✓ Search page
- ✓ Archives page

### Viewports
- ✓ Mobile Small (320x568 - iPhone SE)
- ✓ Mobile Large (414x896 - iPhone 11 Pro Max)
- ✓ Tablet (768x1024 - iPad)
- ✓ Desktop (1920x1080)
- ✓ Desktop (1366x768)

### Features
- ✓ Hero image rendering
- ✓ Image optimization validation
- ✓ Responsive design at all breakpoints
- ✓ Layout consistency

## Pre-Launch Checklist

### 48 Hours Before Launch
```bash
# 1. Generate baselines from local dev
npm run test:visual:baseline

# 2. Verify all local tests pass
npm run test:visual

# 3. Review HTML report
npm run test:visual:report
```

### 24 Hours Before Launch
```bash
# 1. Deploy staging build (with BUILD_ENV=staging in GitHub Actions)
# 2. Test staging renders correctly
npm run test:visual:staging

# 3. Review report - staging may differ from local due to base path
# Expected: Layout variations due to /astro-blog/ base path, but no broken images/content
npm run test:visual:report

# 4. Verify key pages load correctly:
#    - https://kyleskrinak.github.io/astro-blog/ (home)
#    - https://kyleskrinak.github.io/astro-blog/posts/ (blog archive)
#    - https://kyleskrinak.github.io/astro-blog/about.html (about)
```

### Launch Day
```bash
# 1. Deploy to production
# 2. Production should use base path "/"
# 3. Run visual tests against production
npm run test:visual:production

# 4. Production should match local baselines (same base path "/")
npm run test:visual:report

# 5. Spot-check key URLs:
#    - https://kyle.skrinak.com/ (home)
#    - https://kyle.skrinak.com/posts/ (blog archive)
#    - Test Jekyll redirects: https://kyle.skrinak.com/2025/09/19/modernizing-an-old-jekyll-blog-with-github-actions-and-ai/
```

### Post-Launch
```bash
# Run weekly to catch regressions
npm run test:visual:production

# Compare to baseline report
npm run test:visual:report
```

## Understanding Test Results

### Passing Tests ✓
All screenshots match baselines within tolerance (0.1% diff allowed for antialiasing).

### Failing Tests ✗
Visual differences detected. Options:
1. If unintended: Debug and fix the regression
2. If intentional: Update baselines with `npm run test:visual:baseline`

### HTML Report
After tests run, view detailed results:
```bash
npm run test:visual:report
```

Shows:
- Side-by-side comparison of baseline vs actual
- Diff highlighting what changed
- Device and viewport details
- Pass/fail status for each test

## Debugging Failed Tests

### View the Failure
```bash
npm run test:visual:report
```
Opens interactive HTML showing pixel-perfect differences.

### Debug in Browser
```bash
npx playwright test --debug
```
Opens Playwright Inspector for interactive debugging.

### Update if Intentional
```bash
npm run test:visual:baseline
```
Re-generates screenshots as new baselines (after code changes).

## Environment-Specific Testing

### Important: Base Path Configuration

This blog uses **environment-specific base paths** set in `astro.config.ts`:
- **Local/Production**: `base: "/"`
- **Staging (GitHub Pages)**: `base: "/astro-blog/"`

This means **local and staging render differently by design**. Asset paths, links, and layout may vary based on the environment.

### Baseline Management by Environment

Each environment should have its own baseline set:

```
tests/visual/__screenshots__/                  # Local dev baselines
  ├── home-desktop-chromium-darwin.png
  ├── home-mobile-chromium-darwin.png
  └── ... (36 baseline images)
```

**Generate baselines for each environment:**

```bash
# Local dev (base = "/")
npm run test:visual:baseline

# Staging (base = "/astro-blog/" + GitHub Pages subdirectory)
npm run test:visual:staging

# Production (base = "/" at kyle.skrinak.com)
npm run test:visual:production
```

**Expected behavior:**
- Local tests should always pass when compared to local baselines
- Staging tests may show layout differences due to base path redirects
- Production tests should match staging (same base path configuration)

### Testing Multiple Browsers
Config includes Chromium and mobile browsers. To test Firefox:
Edit `playwright.config.ts` and add:
```typescript
{
  name: 'firefox',
  use: { ...devices['Desktop Firefox'] },
}
```

### Testing Dark Mode
Add to tests to simulate dark theme:
```typescript
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  localStorage.setItem('theme', 'dark');
});
```

### Testing Different Languages
If multi-language support is added:
```typescript
await page.goto('/?lang=es'); // Spanish
await page.goto('/?lang=fr'); // French
```

## CI/CD Integration (Post-Launch)

Add to GitHub Actions workflow to run on every push:

```yaml
- name: Run visual regression tests
  run: npm run test:visual

- name: Upload report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
```

## Troubleshooting

### Tests timeout or hang
```bash
# Increase timeout in playwright.config.ts
timeout: 60000 // 60 seconds
```

### Images not loading in screenshots
- Ensure page has fully loaded with `waitForLoadState('networkidle')`
- Add explicit wait: `await page.waitForTimeout(2000)`

### Flaky tests on CI
- Disable animations: `prefers-reduced-motion: reduce`
- Increase tolerance: `maxDiffPixelRatio: 0.15`
- Retry on CI: Set `retries: 2` in config

### Different rendering on Mac vs Linux
This is normal for Playwright (different OS rendering). Use `--update-snapshots` if needed.

## File Structure

```
tests/
├── visual/
│   ├── README.md (this file)
│   ├── visual-regression.spec.ts (test definitions)
│   └── __screenshots__/ (generated baselines)
│       ├── home-desktop.png
│       ├── home-mobile.png
│       ├── blog-archive-desktop.png
│       ├── blog-post-2025-09-19-desktop.png
│       └── ... (35+ screenshots)
playwright.config.ts (configuration)
scripts/visual-test.sh (helper script)
```

## Tips for Success

1. **Commit baselines** to version control so team sees expected changes
2. **Review diffs carefully** before accepting failures as baselines
3. **Run before pushing** to catch regressions early
4. **Test all environments** before launch (local → staging → production)
5. **Keep tests updated** when intentionally changing design

## Resources

- [Playwright Test Docs](https://playwright.dev/docs/intro)
- [Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Configuration Options](https://playwright.dev/docs/test-configuration)
- [Best Practices](https://playwright.dev/docs/best-practices)
