// Determine website URL based on SITE_URL env var or build environment
// NOTE: Both staging and production builds use BUILD_ENV=production
// Staging is distinguished by SITE_URL (workflow sets it) or by fallback to github.io
// See: docs/operations/staging-url-reference.md for details
const buildEnv = process.env.BUILD_ENV || "production";
const siteUrl = process.env.SITE_URL; // Explicit override from workflow (staging: github.io/, production: kyle.skrinak.com/)
const isProduction = buildEnv === "production";
const website = siteUrl || (isProduction ? "https://kyle.skrinak.com/" : "https://kyleskrinak.github.io");

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
    url: "https://github.com/kyleskrinak/astro-blog/edit/staging/",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "America/New_York", // Default global timezone (IANA format)
} as const;
