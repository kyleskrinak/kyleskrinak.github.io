# Visual Regression Testing Strategy

## Current State
**Status:** ⚠️ Not yet implemented

No automated visual regression tests have been established. Before Astro goes live, we need baselines to verify no visual regressions between environments.

## Recommended Approach: Playwright + Percy

### Option 1: Percy.io (Cloud-based, Recommended for Launch)
**Best for:** Quick setup, minimal maintenance, excellent for launch validation

**Setup:**
```bash
npm install --save-dev @percy/cli @percy/playwright
```

**Creates snapshots for comparison:**
- Local baseline → Staging → Production
- Cross-browser comparison (Chrome, Firefox, Safari)
- Mobile vs desktop views
- Light mode vs dark mode

**Key pages to capture:**
- Home page
- Blog archive
- Individual blog post
- Tag/category pages
- Search page
- About page

**Cost:** Free tier supports up to 5,000 snapshots/month

---

### Option 2: Playwright with Local Screenshots (DIY)
**Best for:** Full control, no cloud dependency

**Setup:**
```bash
npm install --save-dev @playwright/test
```

**Create test file: `tests/visual-regression.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {

  // Home page
  test('home page should match baseline', async ({ page }) => {
    await page.goto('http://localhost:4321/');
    await expect(page).toHaveScreenshot('home-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1
    });
  });

  // Blog post
  test('blog post should match baseline', async ({ page }) => {
    await page.goto('http://localhost:4321/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/');
    await expect(page).toHaveScreenshot('blog-post.png', {
      fullPage: true
    });
  });

  // Blog archive
  test('blog archive should match baseline', async ({ page }) => {
    await page.goto('http://localhost:4321/posts/');
    await expect(page).toHaveScreenshot('blog-archive.png', {
      fullPage: true
    });
  });

  // Tag page
  test('tag page should match baseline', async ({ page }) => {
    await page.goto('http://localhost:4321/tags/jekyll/');
    await expect(page).toHaveScreenshot('tag-page.png', {
      fullPage: true
    });
  });

  // Search page
  test('search page should match baseline', async ({ page }) => {
    await page.goto('http://localhost:4321/search/');
    await expect(page).toHaveScreenshot('search-page.png', {
      fullPage: true
    });
  });

  // Dark mode (if applicable)
  test('home page dark mode should match baseline', async ({ page }) => {
    await page.goto('http://localhost:4321/');
    // Simulate dark mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    });
    await expect(page).toHaveScreenshot('home-page-dark.png', {
      fullPage: true
    });
  });

  // Mobile viewport
  test('home page mobile should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:4321/');
    await expect(page).toHaveScreenshot('home-page-mobile.png', {
      fullPage: true
    });
  });
});
```

**Run tests:**
```bash
# Generate baselines (first run)
npx playwright test --update-snapshots

# Compare against baselines
npx playwright test

# Run on specific environment
PLAYWRIGHT_TEST_BASE_URL=https://staging-url npx playwright test
```

---

## Pre-Launch Visual Regression Testing Checklist

### Phase 1: Establish Baselines (Local)
- [ ] Create baseline screenshots on localhost:4321 (dev mode)
- [ ] Capture 10+ key pages (home, posts, tags, search, etc.)
- [ ] Test light mode + dark mode
- [ ] Test desktop + mobile viewports
- [ ] Save baselines to `tests/baseline-screenshots/`

### Phase 2: Staging Validation
- [ ] Run tests against staging URL
- [ ] Compare staging screenshots to baselines
- [ ] Document any expected differences
- [ ] Fix visual regressions if found

### Phase 3: Production Validation (After Launch)
- [ ] Run full test suite against production
- [ ] Compare production to staging
- [ ] Verify no unexpected visual changes
- [ ] Update baselines if needed

### Phase 4: Ongoing Monitoring
- [ ] Run visual tests on every staging build
- [ ] Include in CI/CD pipeline (GitHub Actions)
- [ ] Set alerts for visual regression failures

---

## Critical Pages to Test (Minimum)

| Page | Desktop | Mobile | Light | Dark | Notes |
|------|---------|--------|-------|------|-------|
| Home | ✓ | ✓ | ✓ | ✓ | Primary entry point |
| Blog Post | ✓ | ✓ | ✓ | ✓ | Hero image rendering |
| Blog Archive | ✓ | ✓ | ✓ | - | Pagination, post cards |
| Tag Page | ✓ | ✓ | - | - | Dynamic content |
| Search | ✓ | ✓ | ✓ | - | Interactive element |
| About | ✓ | ✓ | ✓ | - | Static page |

---

## Recommended Launch Procedure

### 48 Hours Before Launch
1. Generate baseline screenshots from local dev
2. Run full visual regression suite locally
3. Fix any visual issues found

### 24 Hours Before Launch
1. Deploy staging build
2. Run visual tests against staging URL
3. Compare staging vs local baselines
4. Document any environment-specific differences

### Day of Launch
1. Final visual regression check
2. Deploy to production
3. Run visual tests against production
4. Compare production vs staging
5. If issues found, revert or hotfix

### Post-Launch
1. Run visual tests weekly
2. Monitor for unexpected changes
3. Update baselines after intentional design changes

---

## Tools Comparison

| Tool | Setup | Cost | Cloud | CI/CD | Best For |
|------|-------|------|-------|-------|----------|
| **Percy.io** | Easy | Free tier | ✓ | ✓ | Launch readiness |
| **Playwright** | Medium | Free | - | ✓ | Self-hosted, control |
| **Cypress** | Medium | Free | ✓ | ✓ | E2E + visual |
| **BackstopJS** | Complex | Free | - | ✓ | Advanced diffing |

**Recommendation for your launch:** Start with **Percy.io** for quick validation, then migrate to **Playwright** if you want long-term self-hosted solution.

---

## Implementation Timeline

| When | What | Effort |
|------|------|--------|
| **Now** | Set up Playwright locally | 1-2 hours |
| **This week** | Generate baselines | 30 minutes |
| **Before launch** | Run against staging | 15 minutes |
| **Launch day** | Final validation | 15 minutes |
| **Ongoing** | Weekly regression checks | 10 minutes |

---

## Next Steps

Choose one approach and I'll help you implement it:

1. **Percy.io** - Cloud-based, easy setup, great for validation
2. **Playwright** - Local, self-hosted, full control
3. **Both** - Percy for launch, Playwright for ongoing

Which would you prefer?
