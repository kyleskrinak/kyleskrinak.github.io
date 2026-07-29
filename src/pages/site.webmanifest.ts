import type { APIRoute } from "astro";
import { SITE } from "@/config";

export const GET: APIRoute = () => {
  const baseUrl = import.meta.env.BASE_URL || "/";

  const manifest = {
    name: SITE.title,
    short_name: SITE.shortName,
    description: SITE.desc,
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
    theme_color: SITE.themeColor,
    background_color: SITE.backgroundColor,
    display: SITE.display,
    scope: baseUrl,
    start_url: baseUrl,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
    },
  });
};
