import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";
import { HERO_IMAGE } from "@/site-config";

/**
 * The og:image for a post with a hero and no frontmatter `ogImage`. Called from
 * upstream's post route from one line; see UPSTREAM.md.
 *
 * Uses the same derivative the hero <Image> in PostHero.astro renders, not the
 * raw source: the source is whatever the author supplied (some are portrait,
 * and several exceed 900KB), so scrapers center-crop it and ignore
 * `imagePosition`. Sharing HERO_IMAGE with the <Image> means identical
 * transform params, so this resolves to that same generated file and emits no
 * extra asset. No format check is needed — content.config.ts rejects SVG heroes
 * at build time, so `image` is always a raster Sharp can crop.
 */
export async function getHeroOgImageSrc(
  image: ImageMetadata,
  imagePosition?: string
): Promise<string> {
  const ogHero = await getImage({
    src: image,
    ...HERO_IMAGE,
    position: imagePosition || "center",
  });
  return ogHero.src;
}
