import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = site ? new URL("sitemap.xml", site) : undefined;

  const body = [
    "User-agent: *",
    "Allow: /",
    sitemapURL ? `Sitemap: ${sitemapURL.href}` : "Sitemap: /sitemap.xml",
    "",
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
};
