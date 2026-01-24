import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const deployEnv = import.meta.env.PUBLIC_DEPLOY_ENV ?? "production";
  const isStaging = deployEnv === "staging";

  const sitemapURL = site ? new URL("sitemap-index.xml", site) : undefined;

  const body = isStaging
    ? ["User-agent: *", "Disallow: /", ""].join("\n")
    : [
        "User-agent: *",
        "Allow: /",
        sitemapURL ? `Sitemap: ${sitemapURL.href}` : "Sitemap: /sitemap-index.xml",
        "",
      ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
};
