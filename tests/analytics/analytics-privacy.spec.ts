import { test, expect } from "@playwright/test";
import { BASE_URL } from "../test-utils";

/**
 * Test Cloudflare Analytics privacy signal detection
 * Verifies that the beacon respects DNT and GPC signals
 *
 * Usage:
 *   # Ensure PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN is set for the preview build.
 *   # A dummy non-empty value is sufficient if you only need to validate the gating logic, e.g.:
 *   #   PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=dummy-token npm run build && npm run preview
 *   npm run build && npm run preview  # In terminal 1
 *   npx playwright test tests/analytics-privacy.spec.ts   # In terminal 2
 */

test.describe("Cloudflare Analytics Privacy Signals", () => {
  // Skip if running against dev server (analytics only load in production builds)
  test.skip(BASE_URL.includes(':4321'), 'Analytics tests require production build (npm run build && npm run preview)');

  test("should load beacon script when no privacy signals are set", async ({ page, context }) => {
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

    // Check if beacon script was added to the page
    const beaconScript = page.locator('script[src*="cloudflareinsights.com/beacon.min.js"]');
    await expect(beaconScript).toHaveCount(1);
  });

  test("should load beacon when DNT is '0' (explicit consent)", async ({ page, context }) => {
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

    // Beacon script should be present (DNT=0 means user consents to tracking)
    const beaconScript = page.locator('script[src*="cloudflareinsights.com/beacon.min.js"]');
    await expect(beaconScript).toHaveCount(1);
  });

  test("should load beacon when GPC is explicitly false", async ({ page, context }) => {
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

    // Beacon script should be present when GPC is explicitly disabled
    const beaconScript = page.locator('script[src*="cloudflareinsights.com/beacon.min.js"]');
    await expect(beaconScript).toHaveCount(1);
  });

  test("should NOT load beacon when DNT is '1'", async ({ page, context }) => {
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

    // Beacon script should NOT be present
    const beaconScript = page.locator('script[src*="cloudflareinsights.com/beacon.min.js"]');
    await expect(beaconScript).toHaveCount(0);
  });

  test("should NOT load beacon when DNT is 'yes'", async ({ page, context }) => {
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

    // Beacon script should NOT be present
    const beaconScript = page.locator('script[src*="cloudflareinsights.com/beacon.min.js"]');
    await expect(beaconScript).toHaveCount(0);
  });

  test("should NOT load beacon when GPC is true", async ({ page, context }) => {
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

    // Beacon script should NOT be present
    const beaconScript = page.locator('script[src*="cloudflareinsights.com/beacon.min.js"]');
    await expect(beaconScript).toHaveCount(0);
  });

  test("should NOT load beacon when both DNT and GPC are enabled", async ({ page, context }) => {
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

    // Beacon script should NOT be present
    const beaconScript = page.locator('script[src*="cloudflareinsights.com/beacon.min.js"]');
    await expect(beaconScript).toHaveCount(0);
  });
});
