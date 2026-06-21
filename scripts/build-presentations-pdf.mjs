#!/usr/bin/env node
/**
 * Generate a single landscape PDF of all standalone presentation decks.
 *
 *   node scripts/build-presentations-pdf.mjs [--output <path>]
 *   npm run archive:presentations
 *
 * The decks in public/presentations/*.html are navigated single-slide views
 * (each `.slide` is position:absolute / display:none, shown one at a time by
 * JavaScript). They are all produced by the same generateHtml() template, so
 * they share an identical stylesheet. This script:
 *   1. serves public/ over HTTP so decks' root-relative assets (/presentations/
 *      assets/...) resolve,
 *   2. loads each deck and extracts its `.presentation-container` markup + title,
 *   3. concatenates every deck into one document with a single copy of the
 *      shared stylesheet plus a print override that reveals every slide and
 *      lays each out as one 16:9 landscape page,
 *   4. prepends a linked table of contents, puts a blank page between decks,
 *      and prints the combined document to one PDF via Chromium.
 *
 * No PDF-merge dependency: it relies on the decks being uniform. Navigation
 * <script>s are intentionally dropped (markup only is extracted).
 */
import { createServer } from "node:http";
import { readFile, readdir, mkdir, stat } from "node:fs/promises";
import { dirname, resolve, join, extname, basename, sep } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const DECKS_DIR = join(PUBLIC_DIR, "presentations");
// Page geometry: 1280x720 CSS px at 96dpi = 13.333in x 7.5in (16:9).
const PAGE_W = "13.333in";
const PAGE_H = "7.5in";

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
};

function parseArgs(argv) {
  const args = { output: "public/presentations-archive.pdf" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--output") args.output = argv[++i];
    else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(2);
    }
  }
  return args;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// Minimal static file server rooted at public/, so /presentations/assets/* resolve.
function startStaticServer() {
  return new Promise((resolveServer, rejectServer) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        const filePath = resolve(PUBLIC_DIR, "." + urlPath);
        // Contain within public/ (defense against traversal). Compare against
        // PUBLIC_DIR + separator so a sibling dir (e.g. "public-x") can't escape.
        if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + sep)) {
          res.statusCode = 403;
          return res.end("Forbidden");
        }
        const data = await readFile(filePath);
        res.setHeader("Content-Type", MIME[extname(filePath).toLowerCase()] || "application/octet-stream");
        res.end(data);
      } catch {
        res.statusCode = 404;
        res.end("Not found");
      }
    });
    server.on("error", rejectServer);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolveServer({ server, port });
    });
  });
}

const PRINT_OVERRIDES = `
  @page { size: ${PAGE_W} ${PAGE_H}; margin: 0; }
  html, body {
    overflow: visible !important;
    width: 100% !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }
  .controls, .presenter-window, .slide-nav, .progress-bar, #progressBar { display: none !important; }
  /* Neutralise the deck's viewport-centring layout so slides stack and each
     slide fills exactly one printed page (vw/vh map to the @page box). */
  .presentation-container, .slides-wrapper {
    position: static !important;
    width: 100% !important;
    height: auto !important;
    display: block !important;
    transform: none !important;
    align-items: initial !important;
    justify-content: initial !important;
  }
  .slide {
    position: relative !important;
    display: flex !important;
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    top: 0 !important;
    left: 0 !important;
    overflow: hidden !important;
    animation: none !important;
    break-after: page;
    page-break-after: always;
  }
  /* Keep oversized media inside the page. */
  .slide img, .slide svg, .slide video, .slide table {
    max-width: 100% !important;
    max-height: 78vh !important;
    height: auto !important;
    object-fit: contain;
  }
  .blank-page { height: ${PAGE_H}; break-after: page; page-break-after: always; }
  .toc-page {
    height: ${PAGE_H};
    box-sizing: border-box;
    padding: 0.7in 0.9in;
    color: #111;
    background: #fff;
    break-after: page;
    page-break-after: always;
    font-family: Georgia, "Times New Roman", serif;
  }
  .toc-page h1 { font-size: 26pt; margin: 0 0 0.35in; }
  .toc-page ol { font-size: 15pt; line-height: 2; padding-left: 0.4in; }
  .toc-page a { color: #1a4d8f; text-decoration: none; }
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = resolve(ROOT, args.output);

  // Exclude bundle-test.html — a build test artifact, not a real deck.
  const EXCLUDE = new Set(["bundle-test.html"]);
  const files = (await readdir(DECKS_DIR))
    .filter(f => f.endsWith(".html") && !EXCLUDE.has(f))
    .sort();
  if (files.length === 0) {
    console.error(`✘ No decks found in ${DECKS_DIR}`);
    process.exit(1);
  }

  const { server, port } = await startStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    // 1. Extract markup, shared stylesheet (once), and title from each deck.
    let sharedStyle = "";
    const decks = [];
    for (const file of files) {
      const resp = await page.goto(`${baseUrl}/presentations/${file}`, {
        waitUntil: "load",
        timeout: 60000,
      });
      if (!resp || !resp.ok()) {
        throw new Error(`Failed to load ${file} (status ${resp ? resp.status() : "none"})`);
      }
      const extracted = await page.evaluate(() => {
        const style = Array.from(document.querySelectorAll("style"))
          .map(s => s.textContent)
          .join("\n");
        const container = document.querySelector(".presentation-container");
        return { style, title: document.title || "", container: container ? container.outerHTML : null };
      });
      if (!extracted.container) {
        console.warn(`  · skipping ${file} (no .presentation-container)`);
        continue;
      }
      if (!sharedStyle) sharedStyle = extracted.style;
      else if (extracted.style.trim() !== sharedStyle.trim()) {
        console.warn(`  · ${file} has a different stylesheet; combined PDF assumes uniform decks`);
      }
      decks.push({ file, title: extracted.title || basename(file, ".html"), html: extracted.container });
      console.log(`  · ${file}`);
    }
    if (decks.length === 0) throw new Error("No printable decks extracted.");

    // 2. Build the combined document: TOC, then decks with blank-page separators.
    const toc = `<section class="toc-page">
      <h1>Presentations — Contents</h1>
      <ol>${decks
        .map((d, i) => `<li><a href="#deck-${i}">${escapeHtml(d.title)}</a></li>`)
        .join("")}</ol>
    </section>`;

    const deckBlocks = decks
      .map(
        (d, i) =>
          `<div class="deck" id="deck-${i}" data-deck="${escapeHtml(basename(d.file))}">${d.html}</div>` +
          (i < decks.length - 1 ? `<div class="blank-page"></div>` : "")
      )
      .join("\n");

    const combined = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<base href="${baseUrl}/">
<style>${sharedStyle}</style>
<style>${PRINT_OVERRIDES}</style>
</head><body>${toc}${deckBlocks}</body></html>`;

    await page.setContent(combined, { waitUntil: "load" });

    // Force lazy images and wait, capped so a stuck asset cannot hang the run.
    await page.evaluate(async () => {
      for (const img of document.images) img.loading = "eager";
      await document.fonts.ready;
      const imgs = Array.from(document.images);
      await Promise.race([
        Promise.all(
          imgs.map(img =>
            img.complete
              ? Promise.resolve()
              : new Promise(res => {
                  img.addEventListener("load", res, { once: true });
                  img.addEventListener("error", res, { once: true });
                })
          )
        ),
        new Promise(r => setTimeout(r, 15000)),
      ]);
    });

    // 3. Print.
    await mkdir(dirname(outputPath), { recursive: true });
    await page.pdf({
      path: outputPath,
      width: PAGE_W,
      height: PAGE_H,
      printBackground: true,
      preferCSSPageSize: true,
    });

    const { size } = await stat(outputPath);
    console.log(
      `✅ Wrote ${args.output} — ${decks.length} deck(s), ${(size / 1024 / 1024).toFixed(2)} MB`
    );
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(err => {
  console.error(`✘ ${err.message}`);
  process.exit(1);
});
