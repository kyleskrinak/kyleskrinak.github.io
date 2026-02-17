import { test, expect } from "@playwright/test";
import { BASE_URL } from "./test-utils";

/**
 * Test console errors across key pages
 * Run before pushing to staging to catch console issues early
 *
 * Usage:
 *   npm run dev                    # In terminal 1
 *   npx playwright test tests/console-errors.spec.ts   # In terminal 2
 *
 * Or with a specific environment:
 *   PLAYWRIGHT_TEST_BASE_URL=https://kyleskrinak.github.io/astro-blog \
 *   npx playwright test tests/console-errors.spec.ts
 */

const PAGES_TO_TEST = [
  { path: "/", title: "Home" },
  { path: "/posts/", title: "Posts" },
  { path: "/search/", title: "Search" },
  { path: "/about/", title: "About" },
  { path: "/posts/2016-10-31-first-blog-post/", title: "Sample Post" },
];

test.describe("Console Errors Check", () => {
  test("should have no console errors on key pages", async ({ page }) => {
    const consoleErrors: Array<{ page: string; messages: string[] }> = [];

    // Collect all console messages
    const errorMessages: { [key: string]: string[] } = {};
    PAGES_TO_TEST.forEach((p) => {
      errorMessages[p.path] = [];
    });

    page.on("console", (msg) => {
      // Only collect error and warning messages
      if (msg.type() === "error" || msg.type() === "warning") {
        const currentUrl = page.url();
        const matchedPage = PAGES_TO_TEST.find((p) =>
          currentUrl.includes(p.path)
        );
        if (matchedPage && !errorMessages[matchedPage.path]) {
          errorMessages[matchedPage.path] = [];
        }
        if (matchedPage) {
          errorMessages[matchedPage.path].push(`[${msg.type()}] ${msg.text()}`);
        }
      }
    });

    // Track failed resource loads
    page.on("response", (response) => {
      if (response.status() === 404) {
        const currentUrl = page.url();
        const matchedPage = PAGES_TO_TEST.find((p) =>
          currentUrl.includes(p.path)
        );
        if (matchedPage) {
          errorMessages[matchedPage.path].push(
            `[404] Failed to load: ${response.url()}`
          );
        }
      }
    });

    // Test each page
    for (const pageConfig of PAGES_TO_TEST) {
      const url = `${BASE_URL}${pageConfig.path}`;
      console.log(`\n📄 Testing: ${pageConfig.title} (${pageConfig.path})`);

      try {
        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForTimeout(1000); // Wait for any delayed errors

        const errors = errorMessages[pageConfig.path] || [];

        if (errors.length === 0) {
          console.log(`   ✅ No console errors`);
        } else {
          console.log(`   ❌ Found ${errors.length} console error(s):`);
          errors.forEach((err) => {
            console.log(`      - ${err}`);
          });
          consoleErrors.push({
            page: pageConfig.title,
            messages: errors,
          });
        }
      } catch (error) {
        console.log(`   ❌ Failed to load page: ${error}`);
        consoleErrors.push({
          page: pageConfig.title,
          messages: [`Page failed to load: ${error}`],
        });
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 CONSOLE ERROR SUMMARY");
    console.log("=".repeat(60));

    if (consoleErrors.length === 0) {
      console.log("✅ All pages passed - no console errors detected!");
    } else {
      console.log(`❌ ${consoleErrors.length} page(s) have console errors:\n`);
      consoleErrors.forEach((result) => {
        console.log(`  📄 ${result.page}:`);
        result.messages.forEach((msg) => {
          console.log(`     • ${msg}`);
        });
      });
      console.log("");
    }

    // Assertion: fail test if any errors found
    expect(
      consoleErrors,
      `Console errors detected on ${consoleErrors.length} page(s). See details above.`
    ).toHaveLength(0);
  });

  test("should have favicon and manifest files accessible", async ({ page }) => {
    const faviconChecks = [
      { path: "favicon.ico", name: "favicon.ico" },
      { path: "favicon-96x96.png", name: "favicon-96x96.png" },
      { path: "apple-touch-icon.png", name: "apple-touch-icon.png" },
      { path: "site.webmanifest", name: "site.webmanifest" },
      { path: "web-app-manifest-192x192.png", name: "manifest icon 192x192" },
      { path: "web-app-manifest-512x512.png", name: "manifest icon 512x512" },
    ];

    console.log("\n📄 Favicon Resources Check");
    console.log("=".repeat(60));

    const failedChecks: string[] = [];

    for (const check of faviconChecks) {
      const url = `${BASE_URL}/${check.path}`;
      try {
        const response = await page.goto(url);
        if (response?.status() === 200) {
          console.log(`   ✅ ${check.name}: Found`);
        } else {
          console.log(`   ❌ ${check.name}: Status ${response?.status()}`);
          failedChecks.push(`${check.name} (status: ${response?.status()})`);
        }
      } catch (error) {
        console.log(`   ❌ ${check.name}: Not found`);
        failedChecks.push(`${check.name} - ${error}`);
      }
    }

    expect(
      failedChecks,
      `Favicon resources not accessible: ${failedChecks.join(", ")}`
    ).toHaveLength(0);
  });
});
