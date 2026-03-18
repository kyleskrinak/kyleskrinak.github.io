import type { APIRoute } from "astro";
// Note: PUBLIC_ vars work from both astro:env/client and astro:env/server.
// Using /client so all PUBLIC_ var consumers import from the same endpoint,
// consistent with Layout.astro and GoogleAnalytics.astro.
import { PUBLIC_DEPLOY_ENV } from "astro:env/client";

export const GET: APIRoute = ({ site }) => {
  const deployEnv = PUBLIC_DEPLOY_ENV ?? "production";
  const isStaging = deployEnv === "staging";

  const sitemapURL = site ? new URL("sitemap.xml", site) : undefined;

  const body = isStaging
    ? ["User-agent: *", "Disallow: /", ""].join("\n")
    : [
        "User-agent: *",
        "Allow: /",
        sitemapURL ? `Sitemap: ${sitemapURL.href}` : "Sitemap: /sitemap.xml",
        "",
      ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
};
