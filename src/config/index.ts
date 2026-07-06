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
  defaultOgImage: "og.png", // bare filename (no leading slash); linkWithBase() in Layout.astro resolves it to a root-relative URL. Built by src/pages/og.png.ts.
  dynamicOgImage: true, // when true, posts render Satori per-post OG images instead of falling back to defaultOgImage
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "America/New_York", // Default global timezone (IANA format)
} as const;

// Root-relative path of the build-generated resume PDF. Single source for the
// site code (download link, sitemap). The CI workflow stanzas
// (.github/workflows/*-deploy.yml "Ensure resume PDF" steps) repeat this
// literal because workflows cannot import TS — keep them in sync when
// changing it.
export const RESUME_PDF_PATH = "/resume/kyle-skrinak-resume.pdf";
