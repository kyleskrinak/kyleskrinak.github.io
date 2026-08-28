import { getBlogPosts } from "@/utils/getBlogPosts";
import getSortedPosts from "@/utils/getSortedPosts";
import { getPath } from "@/utils/getPath";
import { linkWithBase } from "@/utils/linkWithBase";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const sorted = getSortedPosts(await getBlogPosts());

  const posts = sorted.map(({ id, filePath, data }) => ({
    title: data.title,
    url: linkWithBase(getPath(id, filePath)),
    pubDate: data.pubDate.toISOString(),
    updatedDate: data.updatedDate ? data.updatedDate.toISOString() : null,
    description: data.description ?? "",
  }));

  return new Response(JSON.stringify(posts), {
    headers: { "Content-Type": "application/json" },
  });
};
