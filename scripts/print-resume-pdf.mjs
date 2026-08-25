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

import { parseFlags, parsePreviewPort } from "./lib/pdf-helpers.mjs";
import { renderResumePdf } from "./lib/resume-render.mjs";

const FLAGS = {
  "--output": { key: "output", value: true },
  "--base-url": { key: "baseUrl", value: true },
};

async function main() {
  // Parsed here, not at module scope: a throw during module evaluation escapes
  // main().catch below and reaches the user as a raw stack trace. Matches
  // build-resume-variant.mjs, which exits 2 on bad configuration input.
  let port;
  try {
    // 4323, shared with build-resume-variant.mjs -- one variable, one meaning.
    port = parsePreviewPort("RESUME_PREVIEW_PORT", 4323);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const args = parseFlags(process.argv.slice(2), FLAGS, { output: "resume.pdf", baseUrl: null });
  await renderResumePdf({ output: args.output, baseUrl: args.baseUrl, port });
}

main().catch(err => {
  console.error(`✘ ${err.message}`);
  process.exit(1);
});
