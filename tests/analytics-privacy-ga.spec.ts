import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:4321";

/**
 * Test Google Analytics (GA4) privacy signal detection
 * Verifies that GA4 respects DNT and GPC signals
 *
 * Usage:
 *   # Build for production (GA only loads in production builds):
 *   npm run build && npm run preview  # In terminal 1
 *   npx playwright test tests/analytics-privacy-ga.spec.ts   # In terminal 2
 */

test.describe("Google Analytics Privacy Signals", () => {
  test("should load GA script when no privacy signals are set", async ({ page, context }) => {
    // Mock navigator properties with no privacy signals
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "doNotTrack", {
        get: () => null,
        configurable: true,
      });
      Object.defineProperty(navigator, "globalPrivacyControl", {
        get: () => undefined,
        configurable: true,
      });
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // Check if GA script was added to the page
    const gaScript = page.locator('script[src*="googletagmanager.com/gtag/js"]');
    await expect(gaScript).toHaveCount(1);
  });

  test("should load GA when DNT is '0' (explicit consent)", async ({ page, context }) => {
    // Mock navigator.doNotTrack to return "0" (explicit consent to tracking)
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "doNotTrack", {
        get: () => "0",
        configurable: true,
      });
      Object.defineProperty(navigator, "globalPrivacyControl", {
        get: () => undefined,
        configurable: true,
      });
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // GA script should be present (DNT=0 means user consents to tracking)
    const gaScript = page.locator('script[src*="googletagmanager.com/gtag/js"]');
    await expect(gaScript).toHaveCount(1);
  });

  test("should load GA when GPC is explicitly false", async ({ page, context }) => {
    // Mock navigator.globalPrivacyControl to return false explicitly
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "doNotTrack", {
        get: () => null,
        configurable: true,
      });
      Object.defineProperty(navigator, "globalPrivacyControl", {
        get: () => false,
        configurable: true,
      });
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // GA script should be present when GPC is explicitly disabled
    const gaScript = page.locator('script[src*="googletagmanager.com/gtag/js"]');
    await expect(gaScript).toHaveCount(1);
  });

  test("should NOT load GA when DNT is '1'", async ({ page, context }) => {
    // Mock navigator.doNotTrack to return "1"
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "doNotTrack", {
        get: () => "1",
        configurable: true,
      });
      Object.defineProperty(navigator, "globalPrivacyControl", {
        get: () => undefined,
        configurable: true,
      });
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // GA script should NOT be present
    const gaScript = page.locator('script[src*="googletagmanager.com/gtag/js"]');
    await expect(gaScript).toHaveCount(0);
  });

  test("should NOT load GA when DNT is 'yes'", async ({ page, context }) => {
    // Mock navigator.doNotTrack to return "yes"
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "doNotTrack", {
        get: () => "yes",
        configurable: true,
      });
      Object.defineProperty(navigator, "globalPrivacyControl", {
        get: () => undefined,
        configurable: true,
      });
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // GA script should NOT be present
    const gaScript = page.locator('script[src*="googletagmanager.com/gtag/js"]');
    await expect(gaScript).toHaveCount(0);
  });

  test("should NOT load GA when GPC is true", async ({ page, context }) => {
    // Mock navigator.globalPrivacyControl to return true
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "doNotTrack", {
        get: () => null,
        configurable: true,
      });
      Object.defineProperty(navigator, "globalPrivacyControl", {
        get: () => true,
        configurable: true,
      });
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // GA script should NOT be present
    const gaScript = page.locator('script[src*="googletagmanager.com/gtag/js"]');
    await expect(gaScript).toHaveCount(0);
  });

  test("should NOT load GA when both DNT and GPC are enabled", async ({ page, context }) => {
    // Mock both privacy signals as enabled
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "doNotTrack", {
        get: () => "1",
        configurable: true,
      });
      Object.defineProperty(navigator, "globalPrivacyControl", {
        get: () => true,
        configurable: true,
      });
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // GA script should NOT be present
    const gaScript = page.locator('script[src*="googletagmanager.com/gtag/js"]');
    await expect(gaScript).toHaveCount(0);
  });
});
