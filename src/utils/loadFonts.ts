import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Font } from "satori";

// Read from the source tree via process.cwd() rather than import.meta.url:
// the bundled chunk that runs this at build time does not preserve the
// project's directory structure, so a URL relative to the compiled file
// does not resolve to the original asset location.
const fontsDir = join(process.cwd(), "src/assets/fonts");

// Cached across calls — loadFonts() is invoked once per OG image (the site
// card plus one per post), and the font data never changes within a build.
let cachedFonts: Font[] | null = null;

async function loadFonts(): Promise<Font[]> {
  if (cachedFonts) return cachedFonts;

  // `style` is font-style (normal/italic), not boldness — weight alone
  // differentiates these two files, both of which are upright.
  const fontsConfig: Array<Pick<Font, "weight" | "style"> & { file: string }> =
    [
      { file: "ibm-plex-mono-400.ttf", weight: 400, style: "normal" },
      { file: "ibm-plex-mono-700.ttf", weight: 700, style: "normal" },
    ];

  cachedFonts = await Promise.all(
    fontsConfig.map(async ({ file, weight, style }) => {
      const buffer = await readFile(join(fontsDir, file));
      const data = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
      return { name: "IBM Plex Mono", data, weight, style };
    })
  );

  return cachedFonts;
}

export default loadFonts;
