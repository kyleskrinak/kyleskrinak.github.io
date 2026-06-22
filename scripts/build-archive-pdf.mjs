#!/usr/bin/env node
/**
 * Generate the complete-archive PDF book from the `/archive-book/` print page.
 *
 *   node scripts/build-archive-pdf.mjs [--output <path>] [--skip-build] [--base-url <url>]
 *   npm run archive:pdf
 *
 * Pipeline: `astro build` -> `astro preview` -> Chromium renders /archive-book/
 * to a 6x9in PDF. Uses the Chromium already installed with @playwright/test, so
 * it needs no extra dependency and renders MDX, components, and WebP at full
 * fidelity (Astro has already resolved those into plain HTML + optimized images).
 *
 * Privacy safeguards baked in (see the archive discussion):
 *   - Post selection is delegated entirely to the page, which reuses the site's
 *     own publish filter — the book can never include drafts or future-dated posts.
 *   - Inline images are the Astro-optimized variants, which are re-encoded by
 *     sharp with metadata (EXIF/GPS) stripped — no photo geolocation leaks.
 *   - The emitted PDF metadata comes from Chromium (Title from <title>, generic
 *     Creator/Producer) and embeds no local username or file paths.
 *   - Non-printable <iframe> embeds are replaced with a visible caption + the URL,
 *     so references survive without pulling third-party frames into the file.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = process.cwd();

function parseArgs(argv) {
  const args = { output: "public/blog-archive.pdf", skipBuild: false, baseUrl: null };
  // Guard flags that take a value: a missing value (end of argv) or another flag
  // in its place is a usage error, not a silent `undefined` that fails later.
  const needValue = (flag, value) => {
    if (value === undefined || value.startsWith("--")) {
      console.error(`Missing value for ${flag}`);
      process.exit(2);
    }
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output") args.output = needValue("--output", argv[++i]);
    else if (a === "--skip-build") args.skipBuild = true;
    else if (a === "--base-url") args.baseUrl = needValue("--base-url", argv[++i]);
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

const PORT = Number(process.env.ARCHIVE_PREVIEW_PORT || 4321);

async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok || res.status === 404) return; // server is up and answering
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Preview server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = resolve(ROOT, args.output);

  // 1. Build (unless reusing an existing dist or an external server).
  if (!args.baseUrl && !args.skipBuild) {
    console.log("→ Building site (astro build)…");
    const build = spawnSync("npx", ["astro", "build"], { stdio: "inherit", cwd: ROOT });
    if (build.status !== 0) {
      console.error("✘ astro build failed.");
      process.exit(build.status ?? 1);
    }
  }

  // 2. Start a preview server unless one was supplied.
  let preview = null;
  let baseUrl = args.baseUrl;
  if (!baseUrl) {
    baseUrl = `http://localhost:${PORT}`;
    console.log(`→ Starting astro preview on :${PORT}…`);
    preview = spawn("npx", ["astro", "preview", "--port", String(PORT)], {
      stdio: ["ignore", "ignore", "inherit"], // surface astro errors (e.g. port in use)
      cwd: ROOT,
      detached: true, // own process group so we can kill the whole tree
    });
    await waitForServer(baseUrl + "/");
  }

  const pageUrl = `${baseUrl.replace(/\/$/, "")}/archive-book/`;
  let browser = null;
  try {
    // 3. Render to PDF.
    console.log(`→ Rendering ${pageUrl} → ${args.output}`);
    browser = await chromium.launch();
    const page = await browser.newPage();
    // Use "load", not "networkidle": video-embed iframes keep connections alive,
    // so the network never goes idle on this page.
    const resp = await page.goto(pageUrl, { waitUntil: "load", timeout: 120000 });
    if (!resp || !resp.ok()) {
      throw new Error(`Failed to load ${pageUrl} (status ${resp ? resp.status() : "none"})`);
    }

    // 4a. Replace non-printable iframe embeds FIRST — before any waiting — so the
    // embedded players stop holding network connections open.
    const rewritten = await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll("iframe"));
      for (const frame of frames) {
        const src = frame.getAttribute("src") || "";
        const fallback = document.createElement("div");
        fallback.className = "print-embed-fallback";
        const label = document.createElement("div");
        label.textContent = "Embedded media (view online):";
        const link = document.createElement("div");
        link.className = "url";
        link.textContent = src;
        fallback.appendChild(label);
        fallback.appendChild(link);
        frame.replaceWith(fallback);
      }
      return frames.length;
    });
    if (rewritten > 0) console.log(`  · replaced ${rewritten} embed(s) with printed URLs`);

    // 4a-bis. Tag external links whose visible text already IS their href, so the
    // print CSS (.chapter a[href^="http"]::after { content: " (" attr(href) ")" })
    // does not print the URL twice (e.g. `[https://x](https://x)` or `<https://x>`).
    const tagged = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.chapter a[href^="http"]'));
      let n = 0;
      for (const a of links) {
        if (a.textContent.trim() === a.getAttribute("href")) {
          a.classList.add("url-in-text");
          n++;
        }
      }
      return n;
    });
    if (tagged > 0) console.log(`  · tagged ${tagged} self-URL link(s) to avoid duplicate printing`);

    // 4b. Force lazy images to load: this is one tall page, so off-screen images
    // with loading="lazy" never enter the viewport in headless. Mark them eager
    // and scroll the full height to trigger their fetch.
    await page.evaluate(async () => {
      for (const img of document.images) img.loading = "eager";
      const step = window.innerHeight || 800;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });

    // 4c. Wait for fonts + images to settle, but CAP the wait so a single image
    // that never fires load/error can never hang the whole run.
    await page.evaluate(async () => {
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

    // 5. Emit the PDF. preferCSSPageSize honours the page's @page 6x9in rule.
    await mkdir(dirname(outputPath), { recursive: true });
    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;text-align:center;font-size:8pt;color:#666;">' +
        'Page <span class="pageNumber"></span> of <span class="totalPages"></span>' +
        "</div>",
    });

    const { size } = await stat(outputPath);
    console.log(`✅ Wrote ${args.output} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  } finally {
    if (browser) await browser.close();
    if (preview && preview.pid) {
      try {
        // POSIX-only: negative PID signals the whole process group (macOS/ubuntu
        // CI runners). Windows has no process groups; this path would need a
        // different teardown there, but the build pipeline never runs on Windows.
        process.kill(-preview.pid, "SIGTERM"); // kill the group, not just npx
      } catch {
        /* already exited */
      }
    }
  }
}

main().catch(err => {
  console.error(`✘ ${err.message}`);
  process.exit(1);
});
