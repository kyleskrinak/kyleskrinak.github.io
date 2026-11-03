import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import sharp from "sharp";
import { getPostSlug } from "@/utils/getPostPaths";
import { postFilter } from "@/utils/postFilter";
import config from "@/config";
// SITE-OVERRIDE: the site's card design (og-templates/post.js), in place of
// upstream's inline card. The template loads its own fonts until step 5 of the
// port moves IBM Plex Mono onto the Fonts API.
import postOgTemplate from "@/utils/og-templates/post";

export async function getStaticPaths() {
  if (!config.features.dynamicOgImage) {
    return [];
  }

  const posts = await getCollection("posts").then(p =>
    p.filter(post => postFilter(post) && !post.data.ogImage)
  );

  return posts.map(post => ({
    params: { slug: getPostSlug(post.id, post.filePath) },
    props: post,
  }));
}

export const GET: APIRoute = async ({ props }) => {
  if (!config.features.dynamicOgImage) {
    return new Response(null, { status: 404, statusText: "Not found" });
  }

  // SITE-OVERRIDE: the site's card design, in place of upstream's inline card.
  const svg = await postOgTemplate(props);

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(pngBuffer), {
    headers: { "Content-Type": "image/png" },
  });
};
