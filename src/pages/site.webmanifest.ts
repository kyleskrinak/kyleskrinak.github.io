import type { APIRoute } from "astro";
import config from "@/config";
import { MANIFEST } from "@/site-config";

export const GET: APIRoute = () => {
  const baseUrl = import.meta.env.BASE_URL || "/";

  const manifest = {
    name: config.site.title,
    short_name: config.site.title,
    description: config.site.description,
    icons: [
      {
        src: `${baseUrl}favicon-96x96.png`,
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: `${baseUrl}web-app-manifest-192x192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${baseUrl}web-app-manifest-192x192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${baseUrl}web-app-manifest-512x512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${baseUrl}web-app-manifest-512x512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    theme_color: MANIFEST.themeColor,
    background_color: MANIFEST.backgroundColor,
    display: MANIFEST.display,
    scope: baseUrl,
    start_url: baseUrl,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
    },
  });
};
