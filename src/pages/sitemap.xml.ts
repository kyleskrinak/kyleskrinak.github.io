import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE } from "@/config";

/**
 * Generates sitemap.xml containing only indexable pages.
 * Excludes pages with noindex directive (tags, categories, pagination, search, etc.)
 *
 * Pages included:
 * - Home page
 * - Static content pages (about, archives, lchf)
 * - Individual blog posts
 * - Individual presentation HTML files
 *
 * Pages excluded (have noindex):
 * - /tags/ and individual tag pages
 * - /categories/ and individual category pages
 * - /posts/ and pagination pages (/posts/2/, etc.)
 * - /presentations/ listing and directory pages
 * - /search/
 * - /404/
 */
export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection("blog");

  // Static indexable pages
  const staticPages = [
    "",           // Home page
    "about/",     // About page
    "lchf/",      // LCHF content page
  ];

  // Conditionally add archives if enabled
  if (SITE.showArchives) {
    staticPages.push("archives/");
  }

  // Individual blog posts (all indexable)
  const postPages = posts.map((post) => `posts/${post.id.replace(/\.mdx?$/, "")}/`);

  // Presentation HTML files (actual content, not directory pages)
  // These are in public/presentations/*.html and are served as /presentations/*.html
  const presentationFiles = [
    "presentations/2019-Feb-SLG.html",
    "presentations/2019-drupalcon-drupal-8-multisite.html",
    "presentations/bundle-test.html",
    "presentations/drupal-intro.html",
    "presentations/drupal-multisite-on-a-dime.html",
    "presentations/tts-profile-mgmt.html",
    "presentations/wohd.html",
    "presentations/code-presentation.html",
  ];

  const urls = [...staticPages, ...postPages, ...presentationFiles];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${new URL(url, site).href}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
};
