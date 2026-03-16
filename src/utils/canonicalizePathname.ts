/**
 * Normalize pathname for canonical URL generation.
 * Ensures trailing slash to match directory-style URLs while preserving
 * the root ('/') and base pathname (basePathname parameter).
 */
export function canonicalizePathname(pathname: string, basePathname: string): string {
  if (pathname === '/' || pathname === basePathname) {
    return pathname;
  }
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}
