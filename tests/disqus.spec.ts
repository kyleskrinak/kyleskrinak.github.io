import { test, expect } from "@playwright/test";
import { BASE_URL, blockDisqus } from "./test-utils";

test.beforeEach(async ({ page }) => {
  await blockDisqus(page);
});

test.describe("Disqus integration", () => {
  test("renders on a standard blog post", async ({ page }) => {
    await page.goto(`${BASE_URL}/posts/2018-10-31-a-pound-of-flesh-and-a-hot-tub/`);
    await expect(page.locator("#disqus_thread")).toBeAttached();
  });

  test("renders on /lchf/ with no identifier (URL-based thread lookup)", async ({ page }) => {
    await page.goto(`${BASE_URL}/lchf/`);
    await expect(page.locator("#disqus_thread")).toBeAttached();
    const inlineScript = await page.locator("script", { hasText: "disqus_config" }).first().textContent();
    expect(inlineScript).toContain("identifier = undefined");
  });

  test("does not render on a presentation page", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/presentations/`);
    if (!response || response.status() !== 200) {
      test.skip(true, "presentations index not available on this environment");
    }
    const firstPresentationLink = await page
      .locator('a[href^="/presentations/"]')
      .filter({ hasNotText: /^Presentations$/ })
      .first()
      .getAttribute("href");
    if (!firstPresentationLink) {
      test.skip(true, "no presentation links found");
    }
    await page.goto(`${BASE_URL}${firstPresentationLink}`);
    await expect(page.locator("#disqus_thread")).toHaveCount(0);
  });

  test("propagates disqusId frontmatter into the inline embed config", async ({ page }) => {
    await page.goto(`${BASE_URL}/posts/2018-10-31-a-pound-of-flesh-and-a-hot-tub/`);
    const inlineScript = await page.locator("script", { hasText: "disqus_config" }).first().textContent();
    expect(inlineScript).toContain('"/lchf/a-pound-of-flesh-and-a-hot-tub"');
  });

  test("first-blog-post has no disqusId (its old thread was reassigned)", async ({ page }) => {
    await page.goto(`${BASE_URL}/posts/2016-10-31-first-blog-post/`);
    const inlineScript = await page.locator("script", { hasText: "disqus_config" }).first().textContent();
    expect(inlineScript).toContain("identifier = undefined");
  });
});
