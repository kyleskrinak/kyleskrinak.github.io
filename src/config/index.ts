// Determine website URL: SITE_URL is set by all build workflows (staging and production).
// Local dev without SITE_URL falls back to the production URL.
// To test with a different URL locally, set SITE_URL explicitly.
//
// NOTE: Uses process.env instead of astro:env because this runs at build time before
// Astro env is fully initialized. Hardcoded fallback URL is validated against
// config/registry.mjs by config/validate.mjs to prevent drift.
const siteUrl = process.env.SITE_URL;
const website = siteUrl || "https://kyle.skrinak.com/";

export const SITE = {
  website,
  author: "Kyle Skrinak",
  profile: "https://github.com/kyleskrinak",
  desc: "Senior Manager, Digital Experience Platform for Gilead Sciences",
  title: "Kyle Skrinak",
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
  // Default OG image filename, served from the site root.
  // Resolved by Layout.astro as `${BASE_URL}${defaultOgImage}`.
  // Generated at build time by src/pages/og.png.ts.
  defaultOgImage: "og.png",
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "America/New_York", // Default global timezone (IANA format)
} as const;
