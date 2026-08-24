/**
 * Format rules for the images that feed the hero / social-card pipeline.
 *
 * Lives outside src/content.config.ts so the decision can be unit-tested:
 * content.config.ts imports `astro:content` and is only loadable inside an
 * Astro build, which left this logic with no test coverage at all. The schema
 * keeps only the three-line mapping of these results onto Zod issues.
 *
 * The two guarded fields have different constraints because they take different
 * routes to the reader:
 *
 *   image   — always re-encoded. HERO_IMAGE crops it with Sharp and emits WebP,
 *             so the source format only has to be something Sharp can decode
 *             and crop. Every raster qualifies; a vector does not, because
 *             `fit`/`position` have nothing to crop in an SVG. Hence a
 *             rejection list, not an allowlist: nothing else needs excluding.
 *
 *   ogImage — served to scrapers verbatim. PostDetails.astro assigns
 *             `initOgImage.src` straight to og:image with no transform, so
 *             whatever the author committed is what Facebook, Slack and
 *             LinkedIn have to decode. That warrants an allowlist of formats
 *             those scrapers actually render.
 */

/**
 * Formats `image` may not be. Sharp re-encodes everything else, so this is the
 * whole exclusion — see the module note above for why it is not an allowlist.
 */
export const HERO_REJECTED_FORMATS = ['svg'] as const;

/**
 * Formats a frontmatter `ogImage` may be, since it reaches scrapers untouched.
 * AVIF and SVG are absent deliberately: neither renders reliably across the
 * major link-preview scrapers. WebP is present because it does, and because the
 * fallback path already ships a WebP og:image derived from the hero.
 */
export const OG_IMAGE_FORMATS = ['webp', 'jpg', 'jpeg', 'png', 'gif'] as const;

/**
 * Read the file extension off an image reference.
 *
 * At schema-validation time `image()` has not resolved to ImageMetadata yet:
 * the value is an internal placeholder string ending in the source path
 * ("__ASTRO_IMAGE_./hero.webp"), so `format` is not available. The trailing
 * extension is the one part that is present both there and on a resolved
 * ImageMetadata's `src`, so that is what this reads.
 *
 * Returns null when no extension can be found. That placeholder shape *is* an
 * Astro internal — a version that changed it (to embedded JSON, say) would make
 * a plain "does it end in .svg" test answer "no" and silently turn the guard
 * into a no-op that still exits 0. Callers must treat null as a failure to
 * evaluate, never as a pass.
 */
export function assetExtension(img: unknown): string | null {
  // The parameter is `unknown` and the return contract is "an extension or
  // null", so every shape that is not a readable reference has to leave through
  // the null branch. Narrowing with typeof rather than asserting `src` is a
  // string is what makes that true: an object whose src is a number would
  // otherwise reach .toLowerCase() and throw, and a throw here escapes
  // superRefine as an unhandled exception instead of becoming the addIssue that
  // the `unreadable` finding below exists to produce.
  const raw = typeof img === 'string' ? img : (img as { src?: unknown } | null)?.src;
  if (typeof raw !== 'string') return null;
  // Cut at the first ? or # so a query string or fragment cannot hide the
  // extension behind them and turn a readable reference into a build failure.
  const path = raw.toLowerCase().split(/[?#]/)[0];
  const match = /\.([a-z0-9]+)$/.exec(path);
  return match ? match[1] : null;
}

export type HeroFormatIssue = { field: string; message: string };

const unreadable = (field: string): HeroFormatIssue => ({
  field,
  message:
    `${field}: could not read a file extension from the image reference, so its ` +
    'format could not be checked. This usually means Astro changed the image() ' +
    'placeholder shape — update assetExtension() in src/utils/heroImageFormat.ts.',
});

/**
 * Check the format of whichever guarded fields are present, and reject any
 * reference this cannot read an extension from rather than waving it through.
 *
 * Shared by the blog and pages collections. Fields the caller's schema does not
 * define are simply absent from `data` and are skipped.
 */
export function heroFormatIssues(
  data: Record<string, unknown>
): HeroFormatIssue[] {
  const issues: HeroFormatIssue[] = [];

  if (data.image) {
    const ext = assetExtension(data.image);
    if (ext === null) {
      issues.push(unreadable('image'));
    } else if ((HERO_REJECTED_FORMATS as readonly string[]).includes(ext)) {
      issues.push({
        field: 'image',
        message:
          // The remedy names the three formats worth reaching for, not every
          // format that would pass. AVIF and TIFF heroes are also accepted —
          // Sharp decodes them and the output is WebP either way — but neither
          // is used in this repo and neither is a sensible thing to advise, so
          // widening the message to match the rule exactly would make it worse
          // advice, not better. The rule is the rejection list above; this
          // string is guidance for the one case that hits it.
          `image must not be ${ext.toUpperCase()}: the hero is cropped by Sharp ` +
          'to a fixed aspect ratio, and a vector gives fit/position nothing to ' +
          'crop. Export a raster (webp, jpg, png) instead.',
      });
    }
  }

  if (data.ogImage) {
    const ext = assetExtension(data.ogImage);
    if (ext === null) {
      issues.push(unreadable('ogImage'));
    } else if (!(OG_IMAGE_FORMATS as readonly string[]).includes(ext)) {
      issues.push({
        field: 'ogImage',
        message:
          `ogImage must be one of ${OG_IMAGE_FORMATS.join(', ')}, not ${ext}. It ` +
          'is served to link-preview scrapers exactly as committed, with no ' +
          'conversion step to rescue a format they cannot decode.',
      });
    }
  }

  return issues;
}
