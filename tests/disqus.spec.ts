import { test, expect } from "@playwright/test";
import { BASE_URL, blockDisqus } from "./test-utils";

test.beforeEach(async ({ page }) => {
  await blockDisqus(page);
});

/**
 * Invoke the inline `window.disqus_config` against a stub `this` and return
 * what it would have written to `this.page`. Tests observable behavior
 * instead of how Astro serializes `define:vars`.
 */
async function inspectDisqusConfig(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const fn = (window as unknown as { disqus_config?: () => void }).disqus_config;
    if (typeof fn !== "function") return null;
    const captured: { url?: string; identifier?: string } = {};
    const stub = { page: captured };
    fn.call(stub);
    return captured;
  });
}

test.describe("Disqus integration", () => {
  test("renders on a standard blog post", async ({ page }) => {
    await page.goto(`${BASE_URL}/posts/2018-10-31-a-pound-of-flesh-and-a-hot-tub/`);
    await expect(page.locator("#disqus_thread")).toBeAttached();
  });

  test("renders on /lchf/ with no identifier (URL-based thread lookup)", async ({ page }) => {
    await page.goto(`${BASE_URL}/lchf/`);
    await expect(page.locator("#disqus_thread")).toBeAttached();
    const config = await inspectDisqusConfig(page);
    expect(config).not.toBeNull();
    expect(config!.identifier).toBeUndefined();
    expect(config!.url).toMatch(/\/lchf\/$/);
  });

  test("does not render on a presentation page", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/presentations/`);
    if (!response || response.status() !== 200) {
      test.skip(true, "presentations index not available on this environment");
      return;
    }
    const firstPresentationLink = await page
      .locator('a[href^="/presentations/"]')
      .filter({ hasNotText: /^Presentations$/ })
      .first()
      .getAttribute("href");
    if (!firstPresentationLink) {
      test.skip(true, "no presentation links found");
      return;
    }
    await page.goto(`${BASE_URL}${firstPresentationLink}`);
    await expect(page.locator("#disqus_thread")).toHaveCount(0);
  });

  test("propagates disqusId frontmatter into the inline embed config", async ({ page }) => {
    await page.goto(`${BASE_URL}/posts/2018-10-31-a-pound-of-flesh-and-a-hot-tub/`);
    const config = await inspectDisqusConfig(page);
    expect(config).not.toBeNull();
    expect(config!.identifier).toBe("/lchf/a-pound-of-flesh-and-a-hot-tub");
  });

  test("first-blog-post has no disqusId (its old thread was reassigned)", async ({ page }) => {
    await page.goto(`${BASE_URL}/posts/2016-10-31-first-blog-post/`);
    const config = await inspectDisqusConfig(page);
    expect(config).not.toBeNull();
    expect(config!.identifier).toBeUndefined();
  });
});
