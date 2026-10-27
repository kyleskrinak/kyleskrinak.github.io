/**
 * Shared resume render core. Exported so print-resume-pdf.mjs (CI) and
 * build-resume-variant.mjs (local) can both use the same lifecycle.
 *
 * renderResume({ outputs, baseUrl, port?, transform? })
 *   - outputs: { pdf?, docx?, txt? } — a path per file to write (relative to
 *     project root or absolute); at least one
 *   - baseUrl: external server URL; omit to spin up `astro preview` over dist/
 *   - port: preview port (default 4323); ignored when baseUrl is provided
 *   - transform(page): async fn run against the live Playwright page BEFORE
 *     content verification — variant scripts use this to apply DOM mutations
 *
 * One render produces every file. The PDF prints the page; the .docx and .txt
 * are written from blocks read out of the same laid-out DOM
 * (resume-formats.mjs), so the three carry identical content. The one-line and
 * one-page checks run on every render, whichever files it writes: they hold
 * for the content, and the content is the same in all three.
 *
 * Writes nothing unless every bullet and admin line fits on one printed line,
 * the PDF is exactly one page (docs/references/manager-tools-rubric.md), and
 * each .docx and .txt reads back to the printed page's content.
 */

import { existsSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { renderedHeadings } from "../../src/lib/remark-resume-sections.mjs";
import { startPreview, stopPreview, waitForServer } from "./pdf-helpers.mjs";
import { buildResumeDocx, verifyResumeDocx } from "./resume-docx.mjs";
import {
  FORMATS,
  buildResumeText,
  extractResumeBlocks,
  verifyBlocksCoverPage,
  verifyResumeText,
} from "./resume-formats.mjs";
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
  // would drop every data-driven heading from the expectations, and because the
  // check below is an includes() test, that loss would weaken verification
  // silently rather than failing.
  const { data, expandedBody } = readResumeSource(RESUME_SOURCE);
  // Each heading as the page prints it: a role's heading carries its whole
  // admin line (dates, title, company, location), folded from the employer
  // line by the remark plugin's own fold, so verifying it proves the dates and
  // the location printed too.
  // normalizeTypography runs on both sides of the comparison, folding dashes and
  // collapsing whitespace, so spacing differences cannot fail this.
  const rendered = renderedHeadings(expandedBody);
  const adminLines = rendered.filter(heading => heading.adminLine).length;
  if (rendered.length === 0 || adminLines === 0) {
    throw new Error(`No section headings/admin lines parsed from ${RESUME_SOURCE}`);
  }
  // The name is the h1 and so the first line of every file; both resume
  // routes throw without it, so it is required here too.
  const name = typeof data.name === "string" ? data.name.trim() : null;
  if (!name) throw new Error(`Frontmatter field 'name' missing in ${RESUME_SOURCE}`);
  // Contact fields are optional in the content schema; the check mirrors
  // that — verify them when present, never require what the schema doesn't.
  const optionalField = field => (typeof data[field] === "string" ? data[field].trim() : null);
  return {
    name,
    email: optionalField("contactEmail"),
    address: optionalField("contactAddress"),
    headings: rendered.map(heading => heading.text),
    adminLines,
  };
}

async function verifyRenderedContent(page) {
  const expected = readExpectedContent();
  const rendered = await page.evaluate(() => document.body.innerText);
  const haystack = normalizeTypography(rendered);
  const missing = [
    ["name", expected.name],
    ["email", expected.email],
    ["address", expected.address],
    ...expected.headings.map(h => ["heading", h]),
  ]
    .filter(([, text]) => text != null)
    .filter(([, text]) => !haystack.includes(normalizeTypography(text)));
  if (missing.length > 0) {
    const list = missing.map(([kind, text]) => `  - ${kind}: ${text}`).join("\n");
    throw new Error(
      `Rendered page is missing expected resume content — no file written:\n${list}`
    );
  }
  const optional = [expected.email && "email", expected.address && "address"]
    .filter(Boolean)
    .join(", ");
  console.log(
    `✓ Content verified against source: name${optional ? `, ${optional}` : ""}, ` +
      `${expected.headings.length} headings (${expected.adminLines} admin lines)`
  );
}

// Count the printed lines a bullet or admin line occupies from its text
// fragments' client rects. Fragments on one line differ in top and height (a
// bold run, a link, another face or size), so equal tops can't identify a
// line. A fragment joins the current line when either one's vertical midpoint
// falls inside the other's band; anything lower starts the next line.
export function countLineBoxes(rects) {
  let lines = 0;
  let band = null;
  for (const rect of [...rects].sort((a, b) => a.top - b.top)) {
    const within = (r, y) => y >= r.top && y <= r.bottom;
    const mid = r => (r.top + r.bottom) / 2;
    if (band && (within(band, mid(rect)) || within(rect, mid(band)))) continue;
    lines += 1;
    band = rect;
  }
  return lines;
}

// The bullets and admin lines that span more than one printed line, with
// their line counts.
export function findWrappedLines(items) {
  return items
    .map(({ text, rects }) => ({ text, lines: countLineBoxes(rects) }))
    .filter(item => item.lines > 1);
}

// Manager Tools keeps each accomplishment to one line, Kyle each admin line,
// and wraps exist only in the print layout, so lay the page out as print does:
// print media, at the width the stylesheet's @page box leaves for content. The
// width rounds down, so a line within a fraction of a pixel of the margin
// fails here rather than passing here and wrapping on paper. Returns the
// wrapped lines and the @page margins in points, which the .docx page setup
// copies. The page stays in this layout afterwards, so block extraction reads
// the print layout too.
async function applyPrintLayout(page) {
  const { contentWidth, margins } = await page.evaluate(() => {
    const pageRules = [];
    const collect = rules => {
      for (const rule of rules) {
        if (rule instanceof CSSPageRule) pageRules.push(rule);
        else if (rule.cssRules) collect(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        collect(sheet.cssRules);
      } catch {
        /* a cross-origin sheet can't carry the resume's @page rule */
      }
    }
    const rule = pageRules.at(-1);
    if (!rule) throw new Error("No @page rule found — the one-line check needs its size and margins.");
    const size = rule.style.getPropertyValue("size").trim();
    const margin = side => rule.style.getPropertyValue(`margin-${side}`).trim();
    const left = margin("left");
    const right = margin("right");
    if (size !== "letter") {
      throw new Error(`@page size is "${size}" — the one-line check assumes letter.`);
    }
    if (!left || !right) {
      throw new Error("@page sets no left/right margin — the one-line check can't size the text column.");
    }
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden";
    document.body.append(probe);
    const measure = width => {
      probe.style.width = width;
      return probe.getBoundingClientRect().width;
    };
    const width = measure(`calc(8.5in - ${left} - ${right})`);
    // CSS px to points; an unset top or bottom margin is zero, as it prints.
    const sides = ["top", "right", "bottom", "left"];
    const pageMargins = Object.fromEntries(sides.map(side => [side, measure(margin(side) || "0px") * 0.75]));
    probe.remove();
    return { contentWidth: width, margins: pageMargins };
  });

  const height = page.viewportSize()?.height ?? 720;
  await page.setViewportSize({ width: Math.floor(contentWidth), height });
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.fonts.ready);

  // Text nodes only: an element's own rect spans every line it wraps across.
  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".resume-content li, .resume-content h2"), el => {
      const rects = [];
      const range = document.createRange();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (r.width > 0 && r.height > 0) rects.push({ top: r.top, bottom: r.bottom });
        }
      }
      return { text: el.textContent.replace(/\s+/g, " ").trim(), rects };
    })
  );
  return { wrapped: findWrappedLines(items), margins };
}

// Page count from the PDF's page-tree root (/Type /Pages ... /Count N).
// Chromium writes this dictionary uncompressed, so a regex over the raw
// bytes is reliable for its own output; returns null if not found.
function countPdfPages(buffer) {
  const m = /\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/.exec(buffer.toString("latin1"));
  return m ? Number(m[1]) : null;
}

export async function renderResume({
  outputs,
  baseUrl,
  // Callers resolve this through parsePreviewPort; the default only guards a
  // caller that omits it, and must not be the dev server's 4321.
  port = 4323,
  transform,
} = {}) {
  const formats = FORMATS.filter(format => outputs?.[format]);
  if (formats.length === 0) {
    throw new Error(`renderResume: no outputs requested (expected one or more of ${FORMATS.join(", ")})`);
  }
  const outputList = formats.map(format => outputs[format]).join(", ");

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
    console.log(`→ Rendering ${pageUrl} → ${outputList}`);
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

    await verifyRenderedContent(page);

    const { wrapped, margins } = await applyPrintLayout(page);

    // Page size and margins come from the stylesheet's @page rule (via
    // preferCSSPageSize); script margins stay zero so the two don't stack.
    // Render to a buffer first: the one-line and one-page checks below must
    // both pass before anything lands on disk, so a failing render can't ship
    // a bad PDF. They report together, so one render shows every fit problem.
    // The PDF renders even when it is not an output: the one-page check needs it.
    const pdf = await page.pdf({
      format: "Letter",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      printBackground: true,
      preferCSSPageSize: true,
    });

    const pages = countPdfPages(pdf);
    const problems = [];
    if (wrapped.length > 0) {
      const list = wrapped.map(b => `  - (${b.lines} lines) ${b.text}`).join("\n");
      problems.push(
        `${wrapped.length} bullet(s) or admin line(s) run past one printed line — ` +
          `each must fit on one. Tighten or cut these rather than shrinking type:\n${list}`
      );
    }
    if (pages !== 1) {
      problems.push(
        `Resume PDF is ${pages ?? "an unknown number of"} page(s) — must be exactly 1. ` +
          `Content has outgrown the one-page constraint; trim content ` +
          `(least relevant bullets first) rather than shrinking type.`
      );
    }

    // Every file is built and read back in memory, so a check that fails on
    // one format leaves no file of any format on disk.
    const files = [];
    if (outputs.pdf) files.push({ format: "pdf", path: outputs.pdf, data: pdf, note: `, ${pages} page` });
    let blockCount = 0;
    if (outputs.docx || outputs.txt) {
      const extracted = await page.evaluate(extractResumeBlocks);
      problems.push(...verifyBlocksCoverPage(extracted));
      const { blocks } = extracted;
      blockCount = blocks.length;
      if (outputs.docx) {
        const docx = await buildResumeDocx(blocks, { margins });
        problems.push(...(await verifyResumeDocx(blocks, docx)));
        files.push({ format: "docx", path: outputs.docx, data: docx, note: "" });
      }
      if (outputs.txt) {
        const text = buildResumeText(blocks);
        problems.push(...verifyResumeText(blocks, text));
        files.push({ format: "txt", path: outputs.txt, data: text, note: "" });
      }
    }

    if (problems.length > 0) {
      throw new Error(`${problems.join("\n")}\nNo file written.`);
    }
    if (blockCount > 0) {
      console.log(`✓ ${blockCount} blocks read from the printed page; each file reads back to them`);
    }

    for (const file of files) {
      const outputPath = path.resolve(ROOT, file.path);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, file.data);
      const { size } = await stat(outputPath);
      console.log(`✅ Wrote ${file.path} (${(size / 1024).toFixed(0)} KB${file.note})`);
    }
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
