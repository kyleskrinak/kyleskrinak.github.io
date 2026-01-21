/**
 * Apply base path to internal links
 * @param path - the path without base prefix
 * @returns path with base prefix applied
 */
export function linkWithBase(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  if (path.startsWith('http')) return path; // external links
  if (path.startsWith('#')) return path; // anchor links

  // Remove leading slash to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Combine base with path
  return `${base}${cleanPath}`;
}
