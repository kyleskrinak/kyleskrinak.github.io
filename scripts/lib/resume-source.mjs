/**
 * Single reader for the resume source file, shared by every Node consumer:
 * lint-resume.mjs, resume-render.mjs (PDF content verification), and
 * build-resume-variant.mjs (entry-id derivation).
 *
 * Each of those used to parse the file itself, which meant the body they
 * inspected was whatever text happened to be typed into it. Now they all read
 * the EXPANDED body — section placeholders replaced by the markdown that
 * src/lib/resume-sections.mjs builds from frontmatter — which is the same text
 * the remark plugin renders into the page and the PDF. One expansion, four
 * consumers, no chance of a heading existing in one view and not another.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { expandResumePlaceholders } from "../../src/lib/resume-sections.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const RESUME_SOURCE = path.join(ROOT, "src/content/pages/resume/index.md");

/**
 * Returns { data, body, expandedBody }:
 *   data         — parsed frontmatter (dates arrive as strings here; Astro's
 *                  schema coerces them to Date, and resume-sections accepts both)
 *   body         — the raw markdown body, placeholders intact
 *   expandedBody — the body every consumer should inspect
 */
export function readResumeSource(sourcePath = RESUME_SOURCE) {
  // Normalize line endings up front — CRLF checkouts must parse identically.
  const raw = readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
  const fm = /^---\n([\s\S]*?)\n---/.exec(raw);
  if (!fm) throw new Error(`No frontmatter found in ${sourcePath}`);

  let data;
  try {
    data = parseYaml(fm[1]);
  } catch (err) {
    throw new Error(`Failed to parse frontmatter in ${sourcePath}: ${err.message}`);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Frontmatter in ${sourcePath} is not a mapping`);
  }

  const body = raw.slice(fm[0].length);
  return { data, body, expandedBody: expandResumePlaceholders(body, data) };
}
