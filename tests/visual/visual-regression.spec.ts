import { test, expect, type Locator, type Page } from '@playwright/test';

// Native `loading="lazy"` images only decode once near the viewport, and a
// fullPage screenshot doesn't scroll first — so scroll each card image into
// view before polling, and scope the poll to this row (not the whole
// document) to avoid hanging on unrelated offscreen `.card-media` elements.
//
// Polls `img.complete` (not `naturalWidth > 0`) so a failed/errored image
// still resolves the wait instead of hanging forever — the browser sets
// `complete` on error too, whereas a `load` listener would never fire.
// `page.waitForFunction`'s `timeout` bounds the wait explicitly rather than
// relying solely on the outer test timeout.
async function waitForCardImagesLoaded(page: Page, cardRow: Locator, timeoutMs = 10000) {
  const cardImages = cardRow.locator('img.card-media');
  const count = await cardImages.count();
  for (let i = 0; i < count; i++) {
    await cardImages.nth(i).scrollIntoViewIfNeeded();
  }
  const rowHandle = await cardRow.elementHandle();
  if (!rowHandle) {
    throw new Error('Could not resolve an element handle for the card row locator');
  }
  try {
    await page.waitForFunction(
      (row: HTMLElement | SVGElement) =>
        Array.from(row.querySelectorAll<HTMLImageElement>('img.card-media')).every(img => img.complete),
      rowHandle,
      { timeout: timeoutMs }
    );
  } finally {
    await rowHandle.dispose();
  }

  // Scrolling leaves the page mid-post, where the scroll-progress bar and the
  // back-to-top button follow the scroll position from scroll handlers that can
  // still be catching up when the screenshot fires. Return to the top, where
  // every other page test captures, and wait until the handlers show it: the
  // bar empty and the button hidden.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(
    () => {
      const bar = document.getElementById('myBar');
      const button = document.getElementById('btt-btn-container');
      return (
        window.scrollY === 0 &&
        (!bar || parseFloat(bar.style.width || '0') === 0) &&
        (!button || button.classList.contains('opacity-0'))
      );
    },
    undefined,
    { timeout: timeoutMs }
  );
}

/**
 * Visual Regression Tests for Astro Blog
 *
 * Run against different environments:
 *
 * Local (default):
 *   npm run test:visual
 *
 * Production:
 *   PLAYWRIGHT_TEST_BASE_URL=https://kyle.skrinak.com npm run test:visual
 *
 * Update baselines:
 *   npm run test:visual:baseline:docker
 *
 * On a non-Linux host, a run that would *overwrite* existing baselines (-u,
 * --update-snapshots=all/changed) is refused by tests/global-snapshot-guard.ts. The
 * default `missing` mode is allowed, since every ordinary run uses it -- but if it
 * creates a baseline, tests/global-snapshot-teardown.ts deletes that file and fails
 * the run. Either way no host-rendered pixels, which do not match CI's Ubuntu
 * rendering, survive to be committed.
 * ALLOW_NATIVE_BASELINE=1 overrides both for throwaway local runs.
 */

// Every page screenshot allows at most this many differing pixels. The limit is
// an absolute count, not a ratio: a ratio of 0.1 let 92,160 pixels of a 1280x720
// page change unnoticed, enough to hide a whole footer row. It also froze stale
// baselines, because the baseline update rewrites only snapshots that fail.
// On 2026-10-31, Docker renders matched their baselines exactly over five passes,
// and CI, which renders natively on ubuntu-latest, rendered with zero differences.
// The allowance is a margin, not cover for known noise.
const PAGE_MAX_DIFF_PIXELS = 100;

test.describe('Visual Regression - Home Page', () => {
  test('home page desktop should match baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Wait for fonts and animations to settle
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('home-page-desktop.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });

  test('home page mobile should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Wait for fonts and animations to settle
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('home-page-mobile.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
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
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });

  test('blog archive mobile should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/posts/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('blog-archive-mobile.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });

  test('individual blog post should match baseline', async ({ page }) => {
    await page.goto('/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/');
    await page.waitForLoadState('networkidle');
    // Wait for hero image to load
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('blog-post-2025-09-19-desktop.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });

  test('blog post mobile should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/posts/2025-09-19-modernizing-an-old-jekyll-blog-with-github-actions-and-ai/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('blog-post-2025-09-19-mobile.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });

  test('older blog post should match baseline', async ({ page }) => {
    await page.goto('/posts/2021-01-16-jekyll-hugo-and-me/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('blog-post-2021-01-16-desktop.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
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
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });

  test('tag archive should match baseline', async ({ page }) => {
    await page.goto('/tags/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('tags-archive-desktop.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });
});

test.describe('Visual Regression - Standalone Pages', () => {
  test('about page should match baseline', async ({ page }) => {
    await page.goto('/about/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('about-desktop.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });

  test('search page should match baseline', async ({ page }) => {
    await page.goto('/search/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('search-desktop.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });

  test('archives page should match baseline', async ({ page }) => {
    await page.goto('/archives/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('archives-desktop.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });

  test('resume page should match baseline', async ({ page }) => {
    await page.goto('/resume/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('resume-desktop.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
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
    const heroSection = page.locator('figure.hero-image');
    await expect(heroSection).toHaveScreenshot('hero-image-render.png', {
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });
});

test.describe('Visual Regression - Card Layout', () => {
  test('funmaxxing post card grid renders correctly at desktop', async ({ page }) => {
    await page.goto('/posts/2026-07-19-funmaxxing/');
    await page.waitForLoadState('networkidle');
    const cardRow = page.locator('.card-row').first();
    await cardRow.waitFor({ state: 'visible' });
    await waitForCardImagesLoaded(page, cardRow);
    await expect(page).toHaveScreenshot('funmaxxing-desktop.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });

  test('funmaxxing post card grid renders correctly at mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/posts/2026-07-19-funmaxxing/');
    await page.waitForLoadState('networkidle');
    const cardRow = page.locator('.card-row').first();
    await cardRow.waitFor({ state: 'visible' });
    await waitForCardImagesLoaded(page, cardRow);
    await expect(page).toHaveScreenshot('funmaxxing-mobile.png', {
      fullPage: true,
      maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
    });
  });
});

// OG images are PNGs that satori renders at build time and only meta tags
// reference, so no page screenshot shows them. Each test reads the page's
// og:image tag, which also checks that the page still points at the satori
// route, then compares the fetched PNG with a baseline. The tag holds the
// production URL, so only its path is fetched against the server under test.
// Satori renders in Node with bundled fonts, so the image is the same under
// every project; the desktop project alone keeps one baseline per image.
// The limit is an absolute pixel count, not a ratio: 1% of a 1200x630 card is
// about 7,500 pixels, more than a whole 28px byline, so a ratio would let a
// changed or missing line of text pass.
const OG_MAX_DIFF_PIXELS = 100;

async function ogImageFromPage(page: Page, path: string): Promise<{ pathname: string; body: Buffer }> {
  await page.goto(path);
  const content = await page.locator('meta[property="og:image"]').getAttribute('content');
  if (!content) {
    throw new Error(`${path} has no og:image meta tag`);
  }
  const { pathname } = new URL(content);
  const response = await page.request.get(pathname);
  expect(response.status(), `GET ${pathname}`).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
  return { pathname, body: await response.body() };
}

test.describe('Visual Regression - OG Images', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'visual-desktop', 'OG images do not vary by device');
  });

  test('site OG image should match baseline', async ({ page }) => {
    const { pathname, body } = await ogImageFromPage(page, '/');
    expect(pathname).toBe('/og.png');
    expect(body).toMatchSnapshot('og-site.png', { maxDiffPixels: OG_MAX_DIFF_PIXELS });
  });

  // These posts have no hero or ogImage, so their cards come from satori. Posts
  // set no author, so the byline falls back to SITE.author.
  // The only satori-rendered title with a non-ASCII character (an em dash), so
  // the card covers glyph lookup beyond ASCII.
  test('non-ASCII-title post OG image should match baseline', async ({ page }) => {
    const { pathname, body } = await ogImageFromPage(page, '/posts/2021-01-19-my-hero-karen/');
    expect(pathname).toBe('/posts/2021-01-19-my-hero-karen/index.png');
    expect(body).toMatchSnapshot('og-post-2021-01-19.png', { maxDiffPixels: OG_MAX_DIFF_PIXELS });
  });

  // The longest satori-rendered title, so the card covers line wrapping.
  test('long-title post OG image should match baseline', async ({ page }) => {
    const { pathname, body } = await ogImageFromPage(page, '/posts/2016-10-31-first-blog-post/');
    expect(pathname).toBe('/posts/2016-10-31-first-blog-post/index.png');
    expect(body).toMatchSnapshot('og-post-2016-10-31.png', { maxDiffPixels: OG_MAX_DIFF_PIXELS });
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

      // Named `viewport-`, not `home-`: these labels are forced widths, not
      // devices. The project axis already encodes device emulation, so
      // viewport-desktop-visual-mobile.png is a 1920px-wide page rendered under
      // iPhone 12 emulation -- a name like home-desktop-visual-mobile.png reads
      // as a device baseline it is not.
      await expect(page).toHaveScreenshot(`viewport-${viewport.name}.png`, {
        fullPage: true,
        maxDiffPixels: PAGE_MAX_DIFF_PIXELS,
      });
    });
  }
});
