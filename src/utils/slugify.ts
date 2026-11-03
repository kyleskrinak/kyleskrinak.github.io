import kebabcase from "lodash.kebabcase";
import slugify from "slugify";

const hasNonLatin = (str: string): boolean => /[^\x00-\x7F]/.test(str);

/**
 * Slugify a string using a hybrid approach:
 * - Latin strings: slugify (e.g. "E2E Testing" → "e2e-testing")
 * - Strings with non-Latin chars: lodash.kebabcase (preserves non-Latin chars)
 */
export const slugifyStr = (str: string): string => {
  // SITE-OVERRIDE: "+" reads as "plus" (5ec6019), so the "Code+" tag keeps its
  // /tags/code-plus/ URL.
  const normalized = str.replace(/\+/g, " plus ");
  if (hasNonLatin(normalized)) {
    return kebabcase(normalized);
  }
  return slugify(normalized, { lower: true });
};

export const slugifyAll = (arr: string[]) => arr.map(str => slugifyStr(str));
