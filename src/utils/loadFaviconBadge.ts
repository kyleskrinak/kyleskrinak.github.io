import { join } from "node:path";
import sharp from "sharp";

// The favicon source has an opaque white background baked into its pixels
// (no real alpha channel). Key it out here: only pixels near pure white fade
// toward transparent (a short ramp gives the edge some antialiasing), while
// anything else — including light skin/highlight tones — stays fully
// opaque. A plain `255 - minChannel` formula would also fade saturated light
// colors (the face's dominant skin tone sampled at ~80% opacity), which
// isn't the background at all.
//
// The "white" is not uniform: the icon has a fake transparency checkerboard
// painted into it, alternating squares of about 247 and 254. A ramp that ran
// all the way to 255 left those squares at different partial alphas, so the
// checkerboard showed through on the card. Everything at or above
// TRANSPARENT_THRESHOLD is background and goes fully transparent; only the
// thin band below it, where the figure's edge blends into the background,
// ramps for antialiasing.
//
// Sourced from the 512x512 manifest icon (not the 96x96 favicon) and resized
// down to the target size with sharp so the OG badge is a clean downscale
// rather than an upscale of a smaller source.
const WHITE_THRESHOLD = 235; // channel value where the fade-to-transparent ramp begins
const TRANSPARENT_THRESHOLD = 245; // at or above this, a pixel is background
async function loadFaviconBadge(size: number): Promise<string> {
  const inputPath = join(
    process.cwd(),
    "public/web-app-manifest-512x512.png"
  );

  const { data, info } = await sharp(inputPath)
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  for (let i = 0; i < data.length; i += channels) {
    const minChannel = Math.min(data[i], data[i + 1], data[i + 2]);
    if (minChannel <= WHITE_THRESHOLD) {
      data[i + 3] = 255;
    } else if (minChannel >= TRANSPARENT_THRESHOLD) {
      data[i + 3] = 0;
    } else {
      const fade =
        (minChannel - WHITE_THRESHOLD) /
        (TRANSPARENT_THRESHOLD - WHITE_THRESHOLD);
      data[i + 3] = Math.round(255 * (1 - fade));
    }
  }

  const pngBuffer = await sharp(data, { raw: { width, height, channels } })
    .png()
    .toBuffer();

  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}

export default loadFaviconBadge;
