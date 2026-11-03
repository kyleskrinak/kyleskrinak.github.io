import type { APIRoute } from "astro";
import sharp from "sharp";
// SITE-OVERRIDE: the site's card design (og-templates/site.js), in place of
// upstream's inline card. The template loads its own fonts until step 5 of the
// port moves IBM Plex Mono onto the Fonts API.
import siteOgTemplate from "@/utils/og-templates/site";

export const GET: APIRoute = async () => {
  // SITE-OVERRIDE: the site's card design, in place of upstream's inline card.
  const svg = await siteOgTemplate();

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(pngBuffer), {
    headers: { "Content-Type": "image/png" },
  });
};
