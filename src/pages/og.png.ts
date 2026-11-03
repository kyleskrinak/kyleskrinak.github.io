import type { APIRoute } from "astro";
import sharp from "sharp";
import { fontData, experimental_getFontFileURL } from "astro:assets";
import { getFontPathByWeight } from "@/utils/getFontPathByWeight";
// SITE-OVERRIDE: the site's card design (og-templates/site.js), in place of
// upstream's inline card.
import siteOgTemplate from "@/utils/og-templates/site";

export const GET: APIRoute = async context => {
  // SITE-OVERRIDE: the site's cards set IBM Plex Mono (astro.config.ts fonts).
  const fonts = fontData["--font-ibm-plex-mono"];
  const regularFontPath = getFontPathByWeight(fonts, 400);
  const boldFontPath = getFontPathByWeight(fonts, 700);

  if (regularFontPath === undefined || boldFontPath === undefined) {
    throw new Error("Cannot find the font path.");
  }

  const [regularData, boldData] = await Promise.all([
    fetch(experimental_getFontFileURL(regularFontPath, context.url)).then(res =>
      res.arrayBuffer()
    ),
    fetch(experimental_getFontFileURL(boldFontPath, context.url)).then(res =>
      res.arrayBuffer()
    ),
  ]);

  // SITE-OVERRIDE: the site's card design, in place of upstream's inline card.
  const svg = await siteOgTemplate({ regularData, boldData });

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(pngBuffer), {
    headers: { "Content-Type": "image/png" },
  });
};
