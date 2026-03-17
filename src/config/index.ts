// Determine website URL: SITE_URL is authoritative (set by workflows), fallback uses BUILD_ENV
// Production/staging workflows both set BUILD_ENV=production and provide SITE_URL
// Local dev without SITE_URL: BUILD_ENV defaults to "production" → kyle.skrinak.com
// To test staging behavior locally: set BUILD_ENV to non-"production" value OR set SITE_URL explicitly
// See: docs/operations/staging-url-reference.md for details
//
// NOTE: Uses process.env instead of astro:env because this runs at build time before
// Astro env is fully initialized. Hardcoded fallback values are validated against
// config/registry.mjs by config/validate.mjs to prevent drift.
const buildEnv = process.env.BUILD_ENV || "production";
const siteUrl = process.env.SITE_URL; // Explicit override from workflow (staging: github.io, production: kyle.skrinak.com)
const isProduction = buildEnv === "production";
const website = siteUrl || (isProduction ? "https://kyle.skrinak.com/" : "https://kyleskrinak.github.io/");

console.log(`🔍 AstroPaper Config: BUILD_ENV="${buildEnv}", website="${website}"`);

export const SITE = {
  website,
  author: "Kyle Skrinak",
  profile: "https://github.com/kyleskrinak",
  desc: "Senior Manager, Digital Experience Platform for Gilead Sciences",
  title: "Kyle Skrinak",
  ogImage: "og_image.jpeg",
  lightAndDarkMode: true,
  postPerIndex: 5,
  postPerPage: 5,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    text: "Edit on GitHub",
    url: "https://github.com/kyleskrinak/kyleskrinak.github.io/edit/main/",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "America/New_York", // Default global timezone (IANA format)
} as const;
