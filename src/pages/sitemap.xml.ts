import type { APIRoute } from "astro";
import { getBlogPosts } from "@/utils/getBlogPosts";
import getSortedPosts from "@/utils/getSortedPosts";
import { getPath } from "@/utils/getPath";
import { RESUME_PDF_PATH, SITE } from "@/config";

/**
 * Generates sitemap.xml containing only indexable pages.
 * Excludes pages with noindex directive (tags, categories, pagination, search, etc.)
 *
 * Pages included:
 * - Home page
 * - Static content pages (about, archives, lchf, resume)
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
 *
 * `lastmod` is emitted only where a real modification date exists — that is, for
 * posts, from their own frontmatter. Stamping the build date on every entry (the
 * previous behaviour) told crawlers that all 65 URLs changed on every deploy,
 * which is both false and self-defeating: a feed where everything always changes
 * carries no signal about what actually did. Static pages, presentation decks and
 * the archive PDFs have no per-entry date to draw on, so they omit the element
 * rather than invent one. Omission is valid per the sitemaps.org schema.
 */

// XML predefined entities. `new URL().href` percent-encodes most delimiters but
// leaves `&` intact, so one query-string URL would otherwise invalidate the whole
// document — a parse error takes the entire sitemap down, not just that entry.
const XML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const escapeXml = (value: string) =>
  value.replace(/[&<>"']/g, char => XML_ENTITIES[char]);

/**
 * W3C datetime truncated to day precision. The sitemaps.org schema accepts a full
 * datetime for `lastmod`; day precision is a deliberate choice rather than a
 * requirement. A post's frontmatter time-of-day tells a crawler nothing it can act
 * on, and a coarser value avoids implying churn finer than the content actually has.
 */
const isoDay = (date: Date) => date.toISOString().split("T")[0];

type SitemapEntry = { path: string; lastmod?: string };

export const GET: APIRoute = async ({ site }) => {
  // getSortedPosts applies postFilter, which excludes future-dated posts. Calling
  // getBlogPosts alone filters drafts only, so scheduled posts used to appear in
  // the sitemap before the pages they point at existed.
  const posts = getSortedPosts(await getBlogPosts());

  // Static indexable pages
  const staticPages: SitemapEntry[] = [
    { path: "" },          // Home page
    { path: "about/" },    // About page
    { path: "lchf/" },     // LCHF content page
    { path: "resume/" },   // Resume page (/resume/print/ is noindex and intentionally NOT listed)
  ];

  // Conditionally add archives if enabled
  if (SITE.showArchives) {
    staticPages.push({ path: "archives/" });
  }

  // Individual blog posts (all indexable). getPath is the same helper the router
  // and RSS feed use: it derives segments from the file path and slugifies each
  // one. Deriving the URL from post.id instead lets the sitemap and the router
  // disagree silently, which is how a sitemap starts advertising 404s.
  const postPages: SitemapEntry[] = posts.map(post => ({
    path: getPath(post.id, post.filePath),
    lastmod: isoDay(post.data.updatedDate ?? post.data.pubDate),
  }));

  // Presentation HTML files (actual content, not directory pages)
  // These are in public/presentations/*.html and are served as /presentations/*.html
  const presentationFiles: SitemapEntry[] = [
    "presentations/2019-Feb-SLG.html",
    "presentations/2019-drupalcon-drupal-8-multisite.html",
    "presentations/drupal-intro.html",
    "presentations/drupal-multisite-on-a-dime.html",
    "presentations/tts-profile-mgmt.html",
    "presentations/wohd.html",
    "presentations/code-presentation.html",
    "presentations/2026-02-22-squarespace-to-astro.html",
  ].map(path => ({ path }));

  // Downloadable archive artifact (the complete-archive PDF book). Indexable so
  // the preservation copy is discoverable/crawlable. The /archive-book/ HTML page
  // that generates it is noindex and intentionally NOT listed here.
  const archiveFiles: SitemapEntry[] = [
    "blog-archive.pdf",
    "presentations-archive.pdf",
    // Same pattern: built by the ensure-release-pdfs action. The /resume/print/
    // HTML page that generates it is noindex and intentionally NOT listed.
    RESUME_PDF_PATH,
  ].map(path => ({ path }));

  const entries = [...staticPages, ...postPages, ...presentationFiles, ...archiveFiles];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(({ path, lastmod }) => {
    const loc = `    <loc>${escapeXml(new URL(path, site).href)}</loc>`;
    const mod = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
    return `  <url>\n${loc}${mod}\n  </url>`;
  })
  .join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
};
