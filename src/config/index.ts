// Determine website URL: SITE_URL is set by all build workflows (staging and production).
// Local dev without SITE_URL falls back to the production URL.
// To test with a different URL locally, set SITE_URL explicitly.
//
// NOTE: Uses process.env instead of astro:env because this runs at build time before
// Astro env is fully initialized. Hardcoded fallback URL is validated against
// config/registry.mjs by config/validate.mjs to prevent drift.
const siteUrl = process.env.SITE_URL;
const website = siteUrl || "https://kyle.skrinak.com/";
const title = "Screenack";

export const SITE = {
  website,
  author: "Kyle Skrinak",
  profile: "https://github.com/kyleskrinak",
  desc: "Won't you join my musings on all things web, better living through low-carb, and whatever else tickles my fancy. Your muse's experience may vary.",
  title,
  shortName: title, // manifest short_name — derived so it can't drift from the brand name
  themeColor: "#0096ff",
  backgroundColor: "#ffffff",
  display: "standalone",
  lightAndDarkMode: true,
  postPerIndex: 5,
  postPerPage: 5,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  blogContactEmail: "muddles.jitter.2t@icloud.com", // dedicated reply-by-email address, distinct from the resume's personal contactEmail
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

// Open Graph card dimensions (1.91:1, the ratio scrapers crop to). Single
// source for every path that produces a social card: the Satori templates in
// src/utils/og-templates/ render at this size, and HERO_IMAGE below derives
// from it so a post's hero doubles as its og:image at the same ratio.
//
// On-page heroes were 1200×600 (2:1) before HERO_IMAGE existed. Moving them to
// this 1200×630 is deliberate, not a side effect of consolidating the two
// literals: 1.91:1 is the better-looking hero, and matching the card ratio means
// what a reader sees on the page is what a link preview shows. The hero-height
// visual baselines predate it and must be regenerated
// (npm run test:visual:baseline:docker) before they pass again.
//
// Changing this again reaches further than social cards. Because HERO_IMAGE
// spreads it, a new ratio here also reshapes every on-page hero AND the printed
// hero in src/pages/archive-book.astro, whose page layout was tuned around the
// current one, and it will invalidate those baselines again. If a future
// social-card size should not move the hero, give HERO_IMAGE its own
// width/height instead of spreading this.
export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
} as const;

// Shared hero-image transform. Every consumer that renders a post hero passes
// this object, so the dimensions cannot drift between them. Astro names
// derivatives by hashing the transform params, so identical params resolve to
// the same generated file — the hero <Image>, the og:image getImage() call in
// PostDetails.astro, and the print hero in archive-book.astro all share one
// asset. `position` is per-post (frontmatter `imagePosition`) and is passed at
// each call site rather than fixed here.
export const HERO_IMAGE = {
  ...OG_IMAGE_SIZE,
  quality: 85,
  format: "webp",
  fit: "cover",
} as const;
