import type { CollectionEntry } from "astro:content";
import postFilter from "./postFilter";

const getSortedPosts = (posts: CollectionEntry<"blog">[]) => {
  return posts
    .filter(postFilter)
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
};

export default getSortedPosts;
