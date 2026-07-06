/**
 * Shared resume PDF render core. Exported so print-resume-pdf.mjs (CI) and
 * build-resume-variant.mjs (local) can both use the same lifecycle.
 *
 * renderResumePdf({ output, baseUrl, port?, transform?, expectedOverrides? })
 *   - output: output path (relative to project root or absolute)
 *   - baseUrl: external server URL; omit to spin up `astro preview` over dist/
 *   - port: preview port (default 4321); ignored when baseUrl is provided
 *   - transform(page): async fn run against the live Playwright page BEFORE
 *     content verification — variant scripts use this to apply DOM mutations
 *   - expectedOverrides: { title? } — override individual verification expectations
 *     (e.g. variant title)
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { startPreview, stopPreview, waitForServer } from "./pdf-helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RESUME_SOURCE = path.join(ROOT, "src/content/pages/resume/index.md");

// Analytics endpoints the print route's full Layout would otherwise hit in
// production builds: aborted so CI regeneration never registers pageviews
// (and their in-flight requests never delay rendering).
const ANALYTICS_HOSTS = [
  "googletagmanager.com",
  "google-analytics.com",
  "cloudflareinsights.com",
];

// Normalize the typographic transformations Astro's markdown pipeline
// (smartypants) applies, so raw-source expectations compare cleanly against
// rendered DOM text. Applied to BOTH sides of every comparison.
function normalizeTypography(s) {
  return s
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ");
}

// Content expectations derived from the resume's single source of truth.
// The rendered DOM is exactly what Chromium prints, so verifying these
// against the page before rendering guarantees the PDF carries the real
// resume content, not a blank/partial/stale render.
export function readExpectedContent() {
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

async function verifyRenderedContent(page, expectedOverrides = {}) {
  const base = readExpectedContent();
  const expected = {
    ...base,
    ...(expectedOverrides.title !== undefined && { title: expectedOverrides.title }),
  };
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

export async function renderResumePdf({
  output,
  baseUrl,
  port = 4321,
  transform,
  expectedOverrides,
} = {}) {
  const outputPath = path.resolve(ROOT, output);

  let preview = null;
  let browser = null;
  try {
    // Start a preview server over dist/ unless an external one was supplied.
    // Spawned inside the try so any failure past this point (including
    // waitForServer) still reaches the finally-block teardown.
    let resolvedBaseUrl = baseUrl;
    if (!resolvedBaseUrl) {
      if (!existsSync(path.join(ROOT, "dist"))) {
        throw new Error("dist/ not found — run `astro build` first or pass --base-url.");
      }
      resolvedBaseUrl = `http://localhost:${port}`;
      console.log(`→ Starting astro preview on :${port}…`);
      preview = startPreview(port, { cwd: ROOT });
      await waitForServer(resolvedBaseUrl + "/", { child: preview });
    }

    const pageUrl = `${resolvedBaseUrl.replace(/\/$/, "")}/resume/print/`;
    console.log(`→ Rendering ${pageUrl} → ${output}`);
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

    // transform runs BEFORE content verification so the verified DOM matches
    // what actually prints (variant DOM mutations happen here).
    if (transform) await transform(page);

    await verifyRenderedContent(page, expectedOverrides);

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
    console.log(`✅ Wrote ${output} (${(size / 1024).toFixed(0)} KB, ${pages} page)`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* never let a close failure skip the preview teardown below */
      }
    }
    stopPreview(preview);
  }
}
