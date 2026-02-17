import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Astro Blog
 *
 * Run against different environments:
 *
 * Local (default):
 *   npx playwright test
 *
 * Staging:
 *   PLAYWRIGHT_TEST_BASE_URL=https://kyleskrinak.github.io/astro-blog npx playwright test
 *
 * Production:
 *   PLAYWRIGHT_TEST_BASE_URL=https://kyle.skrinak.com npx playwright test
 *
 * Update baselines:
 *   npx playwright test --update-snapshots
 */

test.describe('Visual Regression - Home Page', () => {
  test('home page desktop should match baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Wait for fonts and animations to settle
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('home-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test('home page mobile should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('home-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });
});

test.describe('Visual Regression - Blog Posts', () => {
  test('blog archive page should match baseline', async ({ page }) => {
    await page.goto('/posts/');
    await page.waitForLoadState('networkidle');
    // Wait for images to load
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('blog-archive-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test('blog archive mobile should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/posts/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('blog-archive-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test('individual blog post should match baseline', async ({ page }) => {
    await page.goto('/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/');
    await page.waitForLoadState('networkidle');
    // Wait for hero image to load
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('blog-post-2025-09-19-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test('blog post mobile should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('blog-post-2025-09-19-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test('older blog post should match baseline', async ({ page }) => {
    await page.goto('/posts/2021-01-16-jekyll-hugo-and-me/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('blog-post-2021-01-16-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });
});

test.describe('Visual Regression - Tags & Categories', () => {
  test('tag page should match baseline', async ({ page }) => {
    await page.goto('/tags/jekyll/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('tag-jekyll-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test('tag archive should match baseline', async ({ page }) => {
    await page.goto('/tags/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('tags-archive-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test('category archive should match baseline', async ({ page }) => {
    await page.goto('/pages/category-archive/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('category-archive-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });
});

test.describe('Visual Regression - Standalone Pages', () => {
  test('about page should match baseline', async ({ page }) => {
    await page.goto('/about.html');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('about-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test('search page should match baseline', async ({ page }) => {
    await page.goto('/search/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('search-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test('archives page should match baseline', async ({ page }) => {
    await page.goto('/archives/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('archives-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });
});

test.describe('Visual Regression - Image Rendering', () => {
  test('blog post with hero image should render correctly', async ({ page }) => {
    await page.goto('/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/');
    await page.waitForLoadState('networkidle');

    // Wait for image to load
    const heroImage = page.locator('.hero-image img');
    await heroImage.waitFor({ state: 'visible' });
    await page.waitForTimeout(2000);

    // Verify image is actually loaded (not broken)
    const imageSrc = await heroImage.getAttribute('src');
    expect(imageSrc).toBeTruthy();
    expect(imageSrc).not.toContain('undefined');

    // Take screenshot of hero section
    const heroSection = page.locator('div.hero-image');
    await expect(heroSection).toHaveScreenshot('hero-image-render.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('Visual Regression - Responsive Design', () => {
  const viewports = [
    { name: 'mobile-small', width: 320, height: 568 },    // iPhone SE
    { name: 'mobile-large', width: 414, height: 896 },   // iPhone 11 Pro Max
    { name: 'tablet', width: 768, height: 1024 },         // iPad
    { name: 'desktop', width: 1920, height: 1080 },       // Desktop
  ];

  for (const viewport of viewports) {
    test(`home page ${viewport.name} (${viewport.width}x${viewport.height}) should render correctly`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot(`home-${viewport.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
    });
  }
});
