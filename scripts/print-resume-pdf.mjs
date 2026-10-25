#!/usr/bin/env node
/**
 * Print the resume's print route (/resume/print/) to PDF using Playwright, and
 * write the .docx and .txt files from the same render.
 *
 * The print route — not the public /resume/ page — is the one rendering that
 * carries the full contact block (including address), so it is the only
 * correct source for every format.
 *
 * Usage: node scripts/print-resume-pdf.mjs [--output <path.pdf>] [--formats <list>] [--base-url <url>]
 *
 * --output names the PDF; the .docx and .txt go beside it under the same base
 * name. --formats is a comma-separated subset of pdf,docx,txt (default: all
 * three).
 *
 * With --base-url, renders against that server (dev, preview, or deployed).
 * Without it, serves the existing dist/ via `astro preview` (requires a prior
 * `astro build` — this script never builds), renders, and tears the server down.
 *
 * Before writing anything to disk the render is verified: the page must
 * contain every expectation derived from the resume source (name, contact
 * email/address when present, every heading with each role's full admin
 * line), every bullet must fit on one printed line, the PDF must be exactly
 * one page, and each .docx and .txt must read back to the printed page's
 * content. A failure exits non-zero with no file written.
 *
 * Examples:
 *   node scripts/print-resume-pdf.mjs --output dist/resume/kyle-skrinak-resume.pdf
 *   node scripts/print-resume-pdf.mjs --output ./resume.pdf --formats pdf --base-url http://localhost:4321
 */

import { parseFlags, parsePreviewPort } from "./lib/pdf-helpers.mjs";
import { outputPaths, parseFormats } from "./lib/resume-formats.mjs";
import { renderResume } from "./lib/resume-render.mjs";

const FLAGS = {
  "--output": { key: "output", value: true },
  "--formats": { key: "formats", value: true },
  "--base-url": { key: "baseUrl", value: true },
};

async function main() {
  // Parsed here, not at module scope: a throw during module evaluation escapes
  // main().catch below and reaches the user as a raw stack trace. Matches
  // build-resume-variant.mjs, which exits 2 on bad configuration input.
  let port;
  let outputs;
  const args = parseFlags(process.argv.slice(2), FLAGS, {
    output: "resume.pdf",
    formats: "pdf,docx,txt",
    baseUrl: null,
  });
  try {
    // 4323, shared with build-resume-variant.mjs -- one variable, one meaning.
    port = parsePreviewPort("RESUME_PREVIEW_PORT", 4323);
    outputs = outputPaths(args.output, parseFormats(args.formats));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  await renderResume({ outputs, baseUrl: args.baseUrl, port });
}

main().catch(err => {
  console.error(`✘ ${err.message}`);
  process.exit(1);
});
