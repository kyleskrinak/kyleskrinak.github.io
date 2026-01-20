import type { CollectionEntry } from "astro:content";
import { SITE } from "@/config";

const postFilter = ({ data }: CollectionEntry<"blog">) => {
  const isPublishTimePassed =
    Date.now() >
    new Date(data.pubDate).getTime() - SITE.scheduledPostMargin;
  return import.meta.env.DEV || isPublishTimePassed;
};

export default postFilter;
