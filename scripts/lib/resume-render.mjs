/**
 * Shared resume PDF render core. Exported so print-resume-pdf.mjs (CI) and
 * build-resume-variant.mjs (local) can both use the same lifecycle.
 *
 * renderResumePdf({ output, baseUrl, port?, transform?, expectedOverrides? })
 *   - output: output path (relative to project root or absolute)
 *   - baseUrl: external server URL; omit to spin up `astro preview` over dist/
 *   - port: preview port (default 4323); ignored when baseUrl is provided
 *   - transform(page): async fn run against the live Playwright page BEFORE
 *     content verification — variant scripts use this to apply DOM mutations
 *   - expectedOverrides: { title?, requireText? } — override individual
 *     verification expectations (e.g. variant title) and require extra text
 *     injected by a transform (e.g. variant certifications)
 */

import { existsSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { employerLineText } from "../../src/lib/resume-sections.mjs";
import { startPreview, stopPreview, waitForServer } from "./pdf-helpers.mjs";
import { RESUME_SOURCE, readResumeSource } from "./resume-source.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Analytics endpoints the print route's full Layout would otherwise hit in
// production builds: aborted so CI regeneration never registers pageviews
// (and their in-flight requests never delay rendering).
const ANALYTICS_HOSTS = ["cloudflareinsights.com"];

// Normalize the typographic transformations Astro's markdown pipeline
// (smartypants) applies, so raw-source expectations compare cleanly against
// rendered DOM text. Applied to BOTH sides of every comparison.
export function normalizeTypography(s) {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ");
}

// Content expectations derived from the resume's single source of truth.
// The rendered DOM is exactly what Chromium prints, so verifying these
// against the page before rendering guarantees the PDF carries the real
// resume content, not a blank/partial/stale render.
export function readExpectedContent() {
  // The EXPANDED body: section placeholders already replaced by the markdown
  // resume-sections.mjs builds from frontmatter. Parsing the raw body instead
  // would drop every data-driven heading and employer from the expectations,
  // and because the check below is an includes() test, that loss would weaken
  // verification silently rather than failing.
  const { data, expandedBody } = readResumeSource(RESUME_SOURCE);
  const headings = [...expandedBody.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
  // The WHOLE employer line, not just the employer's name: the line renders as
  // one paragraph, so the DOM carries it as a single run and verifying all of it
  // proves the location and the dates printed too. Recognized through
  // resume-sections.mjs, beside the function that writes these lines.
  // normalizeTypography runs on both sides of the comparison, folding dashes and
  // collapsing whitespace, so spacing differences cannot fail this.
  const employers = expandedBody
    .split("\n")
    .map(line => employerLineText(line))
    .filter(Boolean);
  if (headings.length === 0 || employers.length === 0) {
    throw new Error(`No section headings/employers parsed from ${RESUME_SOURCE}`);
  }
  const title = typeof data.title === "string" ? data.title.trim() : null;
  if (!title) throw new Error(`Frontmatter field 'title' missing in ${RESUME_SOURCE}`);
  // Contact fields are optional in the content schema; the check mirrors
  // that — verify them when present, never require what the schema doesn't.
  const optionalField = name => (typeof data[name] === "string" ? data[name].trim() : null);
  return {
    title,
    email: optionalField("contactEmail"),
    address: optionalField("contactAddress"),
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
    // Text a transform injected (variant certifications, skill categories):
    // the source cannot predict it, so the caller declares it.
    ...(expectedOverrides.requireText ?? []).map(t => ["required", t]),
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
  // Callers resolve this through parsePreviewPort; the default only guards a
  // caller that omits it, and must not be the dev server's 4321.
  port = 4323,
  transform,
  expectedOverrides,
} = {}) {
  const outputPath = path.resolve(ROOT, output);

  let preview = null;
  let browser = null;

  // A Ctrl-C / SIGTERM mid-render bypasses the finally block below, which would
  // otherwise leak the detached `astro preview` process group (spawned with
  // detached:true, it outlives this process). Tear it down on a signal, then exit.
  const cleanupAndExit = async code => {
    try {
      stopPreview(preview);
    } catch {
      /* best effort — the port matters more than a clean message */
    }
    // Awaited: process.exit() runs synchronously, so an unawaited close() never
    // finishes and every interrupted render leaks its Chromium process.
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* the exit code below still reports the interrupt */
      }
    }
    process.exit(code);
  };
  const onSigint = () => void cleanupAndExit(130);
  const onSigterm = () => void cleanupAndExit(143);
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

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
      preview = await startPreview(port, { cwd: ROOT });
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
      const certHint = expectedOverrides?.requireText?.length
        ? " If certifications caused the overflow, reduce include_certs."
        : "";
      throw new Error(
        `Resume PDF is ${pages ?? "an unknown number of"} page(s) — must be exactly 1. ` +
          `Content has outgrown the one-page constraint; trim content ` +
          `(weakest bullets first) rather than shrinking type.${certHint} No file written.`
      );
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, pdf);
    const { size } = await stat(outputPath);
    console.log(`✅ Wrote ${output} (${(size / 1024).toFixed(0)} KB, ${pages} page)`);
  } finally {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
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
