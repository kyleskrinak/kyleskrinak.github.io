// Determine environment: production (main branch) or staging (staging branch)
const buildEnv = process.env.BUILD_ENV || "production";
const siteUrl = process.env.SITE_URL; // Allow explicit override for deployment environments
const isProduction = buildEnv === "production";
// NOTE: Staging uses root path (kyleskrinak.github.io is a GitHub Pages user site, must deploy to root)
// See: docs/operations/staging-url-reference.md for details
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
