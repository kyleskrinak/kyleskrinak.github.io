// Site-only constants that upstream AstroPaper's config has no key for.
// Theme settings live in astro-paper.config.ts; see UPSTREAM.md.

// Dedicated reply-by-email address, distinct from the resume's personal
// contactEmail. Read by ReplyViaEmail.astro.
export const BLOG_CONTACT_EMAIL = "muddles.jitter.2t@icloud.com";

// Web app manifest fields (src/pages/site.webmanifest.ts). name and
// description come from astro-paper.config.ts; short_name is the title so it
// can't drift from the brand name.
export const MANIFEST = {
  themeColor: "#0096ff",
  backgroundColor: "#ffffff",
  display: "standalone",
} as const;

// Wall-clock timezone for the site-only pages that print a date of their own:
// the stack page's build date and the archive PDF's post dates. The theme's
// config.site.timezone stays "UTC" because post dates sit at midnight UTC and
// would show a day early in America/New_York.
export const SITE_TIMEZONE = "America/New_York";

// Root-relative paths of the build-generated resume files, all written by one
// render. Single source for the site code (download links, sitemap). The CI
// workflow stanzas (.github/workflows/*-deploy.yml "Ensure resume files" step
// and the S3 upload's excludes and content-typed copies) repeat these literals
// because workflows cannot import TS — keep them in sync when changing them.
export const RESUME_PDF_PATH = "/resume/kyle-skrinak-resume.pdf";
export const RESUME_DOCX_PATH = "/resume/kyle-skrinak-resume.docx";
export const RESUME_TXT_PATH = "/resume/kyle-skrinak-resume.txt";

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
// heroOgImage.ts, and the print hero in archive-book.astro all share one
// asset. `position` is per-post (frontmatter `imagePosition`) and is passed at
// each call site rather than fixed here.
export const HERO_IMAGE = {
  ...OG_IMAGE_SIZE,
  quality: 85,
  format: "webp",
  fit: "cover",
} as const;
