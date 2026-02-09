/**
 * Normalize pathname for canonical URL generation.
 * Strip trailing slash to match Astro's link generation while preserving
 * the root ('/') and BASE_URL (e.g., '/astro-blog/' on staging).
 */
export function canonicalizePathname(pathname: string, basePathname: string): string {
  if (pathname !== '/' && pathname !== basePathname && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}
