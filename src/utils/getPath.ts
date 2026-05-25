import { BLOG_PATH } from "@/content.config";
import { slugifyStr } from "./slugify";

/**
 * Get full path of a blog post
 * @param id - id of the blog post (aka slug)
 * @param filePath - the blog post full file location
 * @param includeBase - whether to include `/posts` in return value
 * @param trailingSlash - whether to enforce a trailing slash when includeBase is true
 * @returns blog post path
 *   - includeBase=true: leading slash and trailing slash are enforced (e.g., `/posts/slug/`)
 *   - includeBase=false: returns a clean route segment with no leading/trailing slashes (e.g., `slug`)
 *   - trailingSlash=false: returns a leading-slash path without a trailing slash (e.g., `/posts/slug`)
 */
export function getPath(
  id: string,
  filePath: string | undefined,
  includeBase = true,
  trailingSlash = includeBase
) {
  const pathSegments = filePath
    ?.replace(BLOG_PATH, "")
    .split("/")
    .filter(path => path !== "") // remove empty string in the segments ["", "other-path"] <- empty string will be removed
    .filter(path => !path.startsWith("_")) // exclude directories start with underscore "_"
    .slice(0, -1) // remove the last segment_ file name_ since it's unnecessary
    .map(segment => slugifyStr(segment)); // slugify each segment path

  const basePath = includeBase ? "/posts" : "";

  // Making sure `id` does not contain the directory
  const blogId = id.split("/");
  const slug = blogId.length > 0 ? blogId.slice(-1) : blogId;

  // Co-located post entry (foo/index.md): Astro's glob loader produces id=`foo`,
  // and filePath includes `foo/index.md`. After stripping `index.md`, the last
  // pathSegment equals the slug — drop it to avoid `/posts/foo/foo/` duplication.
  const dedupedSegments =
    pathSegments && pathSegments.length > 0 && pathSegments[pathSegments.length - 1] === slug[0]
      ? pathSegments.slice(0, -1)
      : pathSegments;

  const path = !dedupedSegments || dedupedSegments.length < 1
    ? [basePath, slug].join("/")
    : [basePath, ...dedupedSegments, slug].join("/");

  if (!includeBase) {
    return path.replace(/^\/+/, "").replace(/\/+$/, "");
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!trailingSlash) {
    return normalized.replace(/\/+$/, "");
  }
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}
