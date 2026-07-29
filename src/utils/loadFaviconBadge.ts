import { join } from "node:path";
import sharp from "sharp";

// The favicon source has an opaque white background baked into its pixels
// (no real alpha channel). Key it out here: alpha is derived from how far a
// pixel is from pure white, so the illustration's ink/skin tones stay opaque
// and the white background fades to transparent with a soft edge.
//
// Sourced from the 512x512 manifest icon (not the 96x96 favicon) and resized
// down to the target size with sharp so the OG badge is a clean downscale
// rather than an upscale of a smaller source.
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
    data[i + 3] = 255 - minChannel;
  }

  const pngBuffer = await sharp(data, { raw: { width, height, channels } })
    .png()
    .toBuffer();

  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}

export default loadFaviconBadge;
