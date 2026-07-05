#!/usr/bin/env node
/**
 * Print the resume's print route (/resume/print/) to PDF using Playwright.
 *
 * The print route — not the public /resume/ page — is the one rendering that
 * carries the full contact block (including address), so it is the only
 * correct PDF source.
 *
 * Usage: node scripts/print-resume-pdf.mjs [--output <path>] [--base-url <url>]
 *
 * With --base-url, renders against that server (dev, preview, or deployed).
 * Without it, serves the existing dist/ via `astro preview` (requires a prior
 * `astro build` — this script never builds), renders, and tears the server down.
 *
 * Before writing anything to disk the render is verified: the page must
 * contain every expectation derived from the resume source (title, contact
 * email/address when present, all section headings, all employers), and the
 * PDF must be exactly one page. A failure exits non-zero with no file written.
 *
 * Examples:
 *   node scripts/print-resume-pdf.mjs --output dist/resume/kyle-skrinak-resume.pdf
 *   node scripts/print-resume-pdf.mjs --output ./resume.pdf --base-url http://localhost:4321
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESUME_SOURCE = path.join(ROOT, "src/content/pages/resume/index.md");

const PORT = Number(process.env.RESUME_PREVIEW_PORT || 4321);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(
    `Invalid RESUME_PREVIEW_PORT '${process.env.RESUME_PREVIEW_PORT}' — must be an integer 1-65535.`
  );
  process.exit(2);
}

// Analytics endpoints the print route's full Layout would otherwise hit in
// production builds: aborted so CI regeneration never registers pageviews
// (and their in-flight requests never delay rendering).
const ANALYTICS_HOSTS = [
  "googletagmanager.com",
  "google-analytics.com",
  "cloudflareinsights.com",
];

function parseArgs(argv) {
  const args = { output: "resume.pdf", baseUrl: null };
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
    else if (a === "--base-url") args.baseUrl = needValue("--base-url", argv[++i]);
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

// Normalize the typographic transformations Astro's markdown pipeline
// (smartypants) applies, so raw-source expectations compare cleanly against
// rendered DOM text. Applied to BOTH sides of every comparison.
function normalizeTypography(s) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ");
}

// Content expectations derived from the resume's single source of truth.
// The rendered DOM is exactly what Chromium prints, so verifying these
// against the page before rendering guarantees the PDF carries the real
// resume content, not a blank/partial/stale render.
function readExpectedContent() {
  // Normalize line endings up front — CRLF checkouts must parse identically.
  const raw = readFileSync(RESUME_SOURCE, "utf8").replace(/\r\n/g, "\n");
  const fm = /^---\n([\s\S]*?)\n---/.exec(raw);
  if (!fm) throw new Error(`No frontmatter found in ${RESUME_SOURCE}`);
  // Contact fields are optional in the content schema; the check mirrors
  // that — verify them when present, never require what the schema doesn't.
  const field = name => {
    const m = new RegExp(`^${name}:\\s*"?([^"\\n]+)"?\\s*$`, "m").exec(fm[1]);
    return m ? m[1].trim() : null;
  };
  const body = raw.slice(fm[0].length);
  const headings = [...body.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
  // Employer lines follow the "**Employer** — location | dates" convention;
  // anchoring on the separator avoids matching arbitrary bold-led paragraphs.
  const employers = [...body.matchAll(/^\*\*(.+?)\*\* — /gm)].map(m => m[1].trim());
  if (headings.length === 0 || employers.length === 0) {
    throw new Error(`No section headings/employers parsed from ${RESUME_SOURCE}`);
  }
  const title = field("title");
  if (!title) throw new Error(`Frontmatter field 'title' missing in ${RESUME_SOURCE}`);
  return {
    title,
    email: field("contactEmail"),
    address: field("contactAddress"),
    headings,
    employers,
  };
}

async function verifyRenderedContent(page) {
  const expected = readExpectedContent();
  const rendered = await page.evaluate(() => document.body.innerText);
  const haystack = normalizeTypography(rendered);
  const missing = [
    ["title", expected.title],
    ["email", expected.email],
    ["address", expected.address],
    ...expected.headings.map(h => ["heading", h]),
    ...expected.employers.map(e => ["employer", e]),
  ]
    .filter(([, text]) => text != null)
    .filter(([, text]) => !haystack.includes(normalizeTypography(text)));
  if (missing.length > 0) {
    const list = missing.map(([kind, text]) => `  - ${kind}: ${text}`).join("\n");
    throw new Error(
      `Rendered page is missing expected resume content — PDF not written:\n${list}`
    );
  }
  const optional = [expected.email && "email", expected.address && "address"]
    .filter(Boolean)
    .join(", ");
  console.log(
    `✓ Content verified against source: title${optional ? `, ${optional}` : ""}, ` +
      `${expected.headings.length} headings, ${expected.employers.length} employers`
  );
}

// Page count from the PDF's page-tree root (/Type /Pages ... /Count N).
// Chromium writes this dictionary uncompressed, so a regex over the raw
// bytes is reliable for its own output; returns null if not found.
function countPdfPages(buffer) {
  const m = /\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/.exec(buffer.toString("latin1"));
  return m ? Number(m[1]) : null;
}

async function waitForServer(url, preview, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // If the spawned server already died (e.g. port in use), fail fast and
    // loud rather than polling a port some other process may be serving.
    if (preview && preview.exitCode !== null) {
      throw new Error(
        `astro preview exited with code ${preview.exitCode} before becoming ready ` +
          `(is port ${PORT} already in use?)`
      );
    }
    try {
      // Per-request timeout so one hung connection can't blow past the deadline.
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000) });
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
  const outputPath = path.resolve(ROOT, args.output);

  let preview = null;
  let browser = null;
  try {
    // Start a preview server over dist/ unless an external one was supplied.
    // Spawned inside the try so any failure past this point (including
    // waitForServer) still reaches the finally-block teardown.
    let baseUrl = args.baseUrl;
    if (!baseUrl) {
      if (!existsSync(path.join(ROOT, "dist"))) {
        throw new Error("dist/ not found — run `astro build` first or pass --base-url.");
      }
      baseUrl = `http://localhost:${PORT}`;
      console.log(`→ Starting astro preview on :${PORT}…`);
      preview = spawn("npx", ["astro", "preview", "--port", String(PORT)], {
        stdio: ["ignore", "ignore", "inherit"], // surface astro errors (e.g. port in use)
        cwd: ROOT,
        detached: true, // own process group so we can kill the whole tree
      });
      await waitForServer(baseUrl + "/", preview);
    }

    const pageUrl = `${baseUrl.replace(/\/$/, "")}/resume/print/`;
    console.log(`→ Rendering ${pageUrl} → ${args.output}`);
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.route("**/*", route => {
      const host = new URL(route.request().url()).hostname;
      if (ANALYTICS_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) {
        return route.abort();
      }
      return route.continue();
    });
    // "load", not "networkidle" — consistent with build-archive-pdf.mjs;
    // readiness is guaranteed by the selector wait and content verification.
    const resp = await page.goto(pageUrl, { waitUntil: "load", timeout: 120000 });
    if (!resp || !resp.ok()) {
      throw new Error(`Failed to load ${pageUrl} (status ${resp ? resp.status() : "none"})`);
    }
    await page.waitForSelector(".resume-content");
    // Fonts must be applied, not just fetched, before measuring a page that
    // is tuned to exactly one page.
    await page.evaluate(() => document.fonts.ready);
    await verifyRenderedContent(page);

    // Page size and margins come from the stylesheet's @page rule (via
    // preferCSSPageSize); script margins stay zero so the two don't stack.
    // Render to a buffer first: the one-page check below must pass before
    // anything lands on disk, so a failing render can't ship a bad PDF.
    const pdf = await page.pdf({
      format: "Letter",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      printBackground: true,
      preferCSSPageSize: true,
    });

    const pages = countPdfPages(pdf);
    if (pages !== 1) {
      throw new Error(
        `Resume PDF is ${pages ?? "an unknown number of"} page(s) — must be exactly 1. ` +
          `Content has outgrown the one-page constraint; trim content ` +
          `(weakest bullets first) rather than shrinking type. No file written.`
      );
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, pdf);
    const { size } = await stat(outputPath);
    console.log(`✅ Wrote ${args.output} (${(size / 1024).toFixed(0)} KB, ${pages} page)`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* never let a close failure skip the preview teardown below */
      }
    }
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
