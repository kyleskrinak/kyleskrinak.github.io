/**
 * Normalize pathname for canonical URL generation.
 * Ensure trailing slash to match directory-style URLs while preserving
 * the root ('/') and BASE_URL (e.g., '/astro-blog/' on staging).
 */
export function canonicalizePathname(pathname: string, basePathname: string): string {
  if (pathname === '/' || pathname === basePathname) {
    return pathname;
  }
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}
