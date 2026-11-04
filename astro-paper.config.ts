import { defineAstroPaperConfig } from "./src/types/config";

// SITE-OVERRIDE: site.url reads SITE_URL. pr-visual-check.yml and
// production-deploy.yml set it; linkwatch.yml and local dev fall back to the
// production URL. config/validate.mjs checks the fallback against
// config/registry.mjs.
const siteUrl = process.env.SITE_URL || "https://kyle.skrinak.com/";
const title = "Screenack";

export default defineAstroPaperConfig({
  site: {
    url: siteUrl,
    title,
    description:
      "What I learn by doing: web platforms, security, AI-assisted development and stuff.",
    author: "Kyle Skrinak",
    profile: "https://github.com/kyleskrinak",
    ogImage: "og.png",
    lang: "en",
    timezone: "UTC",
    dir: "ltr",
  },
  posts: {
    perPage: 5,
    perIndex: 5,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [
    // linkTitle keeps the site's capitalization; the default reads "Github".
    { name: "github",   url: "https://github.com/kyleskrinak", linkTitle: `${title} on GitHub` },
    { name: "x",        url: "https://x.com/screenack" },
    { name: "linkedin", url: "https://www.linkedin.com/in/kyleskrinak/", linkTitle: `${title} on LinkedIn` },
    { name: "facebook", url: "https://www.facebook.com/kyle.skrinak" },
    { name: "substack", url: "https://screenack.substack.com/" },
  ],
  shareLinks: [
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "linkedin", url: "https://www.linkedin.com/sharing/share-offsite/?url=", linkTitle: "Share this post on LinkedIn" },
  ],
});
