# Visual Regression Testing

Playwright-based visual regression tests to catch unintended changes in layout, styling, and responsive design across different environments (local, staging, production).

## Quick Start

### 1. Create Baseline Screenshots (First Time)
```bash
npm run test:visual:baseline:docker
```
This generates reference screenshots in `tests/visual/visual-regression.spec.ts-snapshots/` inside a Docker container matched to `pr-visual-check.yml`'s CI runner (Ubuntu, same Playwright version). **Use this command, not the bare `npm run test:visual:baseline`, whenever the result will be committed** — macOS and Ubuntu render page height differently (font metrics), so macOS-generated baselines fail CI's height comparison even with no real visual change. See [Baseline Management](#baseline-management) below.

### 2. Run Tests Against Local Dev
```bash
npm run test:visual
```
Compares current rendering against baselines. Local dev server starts automatically.

### 3. Test Staging Before Launch
```bash
npm run test:staging -- --project=visual-*
```
Tests against GitHub Pages staging URL. This validates that staging renders identically to local.

### 4. Verify Production After Launch
```bash
npm run test:production -- --project=visual-*
```
Tests against production URL. Should match staging and baselines.

## Available Commands

```bash
# Local dev (auto-starts dev server)
npm run test:visual

# Create/update baselines matching CI's Ubuntu font rendering (use this to commit)
npm run test:visual:baseline:docker

# Run against a container matching CI, without updating baselines
npm run test:visual:docker

# Create/update baselines from local macOS rendering (fast iteration only — do not commit the result)
npm run test:visual:baseline

# Test against staging (GitHub Pages)
npm run test:staging -- --project=visual-*

# Test against production (kyle.skrinak.com)
npm run test:production -- --project=visual-*

# View HTML report of last test run
npm run test:visual:report

# Or use the shell script directly
./scripts/visual-test.sh local              # Local dev
./scripts/visual-test.sh staging            # Staging
./scripts/visual-test.sh production         # Production
./scripts/visual-test.sh baseline           # Create baselines (macOS rendering — fast iteration only)
./scripts/visual-test.sh docker             # Test in a container matching CI's OS/fonts
./scripts/visual-test.sh docker-baseline    # Create/update baselines from that container (use for commits)
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
# 1. Generate baselines matching CI (Ubuntu, via Docker)
npm run test:visual:baseline:docker

# 2. Verify all local tests pass
npm run test:visual

# 3. Review HTML report
npm run test:visual:report
```

### 24 Hours Before Launch
```bash
# 1. Deploy staging build (with BUILD_ENV=production in GitHub Actions)
# 2. Test staging renders correctly
npm run test:staging -- --project=visual-*

# 3. Review report - staging should match local (both use base = "/")
# Expected: Identical rendering to local baselines
npm run test:visual:report

# 4. Verify key pages load correctly:
#    - https://kyleskrinak.github.io/ (home)
#    - https://kyleskrinak.github.io/posts/ (blog archive)
#    - https://kyleskrinak.github.io/about/ (about)
```

### Launch Day
```bash
# 1. Deploy to production
# 2. Production should use base path "/"
# 3. Run visual tests against production
npm run test:production -- --project=visual-*

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
npm run test:production -- --project=visual-*

# Compare to baseline report
npm run test:visual:report
```

## Understanding Test Results

### Passing Tests ✓
All screenshots match baselines within tolerance (0.1% diff allowed for antialiasing).

### Failing Tests ✗
Visual differences detected. Options:
1. If unintended: Debug and fix the regression
2. If intentional: Update baselines with `npm run test:visual:baseline:docker` (use the Docker variant for anything you'll commit — see [Baseline Management](#baseline-management))

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
npm run test:visual:baseline:docker
```
Re-generates screenshots as new baselines (after code changes), rendered on Ubuntu to match CI.

## Environment-Specific Testing

### Important: Base Path Configuration

This blog uses **consistent base path** across all environments set in `astro.config.ts`:
- **All environments (Local/Staging/Production)**: `base: "/"`

This means **all environments render identically**. Staging (GitHub Pages) deploys as a user site at the root path, matching local and production behavior.

### Baseline Management

Baselines are committed to the repo. `snapshotPathTemplate` in `playwright.config.ts` omits the OS suffix so committed baselines *resolve* under any project name on any platform — but resolving a file isn't the same as matching its pixels. macOS and Ubuntu render text with different font metrics, so a page's total height (and therefore every `visual-desktop`/Chromium `fullPage` screenshot) differs by a near-constant offset between the two. `pr-visual-check.yml` runs on `ubuntu-latest`, so baselines must be **generated on Ubuntu** (via the `docker`/`docker-baseline` modes below) to compare cleanly against CI — a bare macOS-generated baseline will fail CI's height comparison even with zero real visual change. (WebKit/`visual-mobile` baselines have not shown this drift in practice, but generating them the same way keeps both projects consistent.)

```
tests/visual/visual-regression.spec.ts-snapshots/  # Committed to repo
  ├── about-desktop-visual-desktop.png       # {arg}-{project}.png (no OS suffix)
  ├── blog-archive-desktop-visual-desktop.png
  ├── home-page-desktop-visual-desktop.png
  └── ... (42 baseline images: 21 screenshots × 2 projects)
```

**Baseline Workflow:**
- **`pr-visual-check.yml`** gates PRs to `staging` by comparing against committed baselines
- **Updating baselines for commit**: run `npm run test:visual:baseline:docker` (runs the official `mcr.microsoft.com/playwright:v<version>-noble` image, version-matched to the installed `@playwright/test`, matching CI's Ubuntu font stack), then commit the updated PNGs
- **Quick local iteration** (not for commit): `npm run test:visual:baseline` regenerates from macOS rendering — fine for eyeballing a change locally, but don't commit the result or CI will fail on font-height drift

**Test commands:**

```bash
# Generate baselines matching CI (Ubuntu, via Docker) — use this before committing
npm run test:visual:baseline:docker

# Verify against those baselines in the same Ubuntu container, without updating them
npm run test:visual:docker

# Test staging against baselines (also base = "/")
npm run test:staging -- --project=visual-*

# Test production against baselines (base = "/" at kyle.skrinak.com)
npm run test:production -- --project=visual-*
```

**Expected behavior:**
- All environments should match baselines (identical rendering with base = "/")
- Tests should pass consistently across local, staging, and production
- Failures indicate unintended visual regressions

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

## CI/CD Integration

Visual regression runs automatically via `.github/workflows/pr-visual-check.yml` on every PR targeting `staging`. The workflow builds the site with production settings, installs Chromium and WebKit, runs `npm run test:visual` against committed baselines, and uploads diff artifacts on failure.

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
`snapshotPathTemplate` removes the OS suffix, so committed baselines *resolve* on any platform — but macOS and Ubuntu font metrics differ enough that `maxDiffPixelRatio: 0.1` doesn't absorb it; expect the height-diff failures described in [Baseline Management](#baseline-management). Regenerate baselines with `npm run test:visual:baseline:docker` rather than raising the tolerance — a looser tolerance would also mask real regressions.

## File Structure

```
tests/
├── visual/
│   ├── README.md (this file)
│   ├── visual-regression.spec.ts (test definitions)
│   └── visual-regression.spec.ts-snapshots/ (committed baselines)
│       ├── about-desktop-visual-desktop.png       # {arg}-{project}.png (no OS suffix)
│       ├── blog-archive-desktop-visual-desktop.png
│       ├── home-page-desktop-visual-desktop.png
│       └── ... (42 snapshots: 21 screenshots × 2 projects)
playwright.config.ts (configuration)
scripts/visual-test.sh (helper script)
```

## Tips for Success

1. **Baselines committed to repo** — update with `npm run test:visual:baseline:docker` (matches CI's Ubuntu font rendering) and commit the PNGs; `pr-visual-check.yml` gates PRs to staging against them
2. **Review diffs carefully** before accepting failures as baselines
3. **Run before pushing** to catch regressions early
4. **Test all environments** before launch (local → staging → production)
5. **Keep tests updated** when intentionally changing design

## Resources

- [Playwright Test Docs](https://playwright.dev/docs/intro)
- [Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Configuration Options](https://playwright.dev/docs/test-configuration)
- [Best Practices](https://playwright.dev/docs/best-practices)
