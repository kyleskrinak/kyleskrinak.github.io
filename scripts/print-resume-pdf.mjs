#!/usr/bin/env node
/**
 * Print resume page to PDF using Playwright
 *
 * Usage: node scripts/print-resume-pdf.mjs [output-path] [base-url]
 *
 * Examples:
 *   node scripts/print-resume-pdf.mjs ./resume.pdf http://localhost:3000
 *   node scripts/print-resume-pdf.mjs ./resume.pdf https://kyle.skrinak.com
 */

import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function printResumePDF(outputPath, baseUrl) {
  let browser;

  try {
    // Default to localhost dev server if no URL provided
    const url = baseUrl || "http://localhost:4321";
    const resumeUrl = new URL("/resume/", url).toString();

    console.log(`Printing ${resumeUrl} to ${outputPath}...`);

    browser = await chromium.launch();
    const page = await browser.newPage();

    // Navigate to resume page
    await page.goto(resumeUrl, { waitUntil: "networkidle" });

    // Wait for content to render
    await page.waitForSelector(".resume-content");

    // Print to PDF. Page size and margins come from the stylesheet's
    // @page rule (via preferCSSPageSize); script margins stay zero so
    // the two don't stack.
    await page.pdf({
      path: outputPath,
      format: "Letter",
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
      printBackground: true,
      preferCSSPageSize: true,
    });

    console.log(`✓ PDF generated: ${outputPath}`);

    await page.close();
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// CLI entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputPath = process.argv[2] || "./resume.pdf";
  const baseUrl = process.argv[3];

  printResumePDF(outputPath, baseUrl).catch((error) => {
    console.error("Error printing resume:", error.message);
    process.exit(1);
  });
}

export { printResumePDF };
