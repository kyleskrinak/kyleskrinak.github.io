#!/usr/bin/env node
/**
 * Detects digit:digit patterns in markdown/MDX content that remark-directive
 * would silently consume as inline directives, causing text to disappear.
 *
 * Skips: fenced code blocks, indented code, frontmatter, URLs, already-escaped colons.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const CONTENT_DIR = new URL("../src/content/blog", import.meta.url).pathname;

function walkDir(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walkDir(full));
    else if (entry.endsWith(".md") || entry.endsWith(".mdx")) files.push(full);
  }
  return files;
}

function check(filepath) {
  const raw = readFileSync(filepath, "utf8");
  const lines = raw.split("\n");
  const hits = [];

  let inFrontmatter = false;
  let frontmatterDone = false;
  let inFencedCode = false;
  let fencePattern = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Frontmatter
    if (lineNum === 1 && line.trimEnd() === "---") { inFrontmatter = true; continue; }
    if (inFrontmatter) {
      if (line.trimEnd() === "---") { inFrontmatter = false; frontmatterDone = true; }
      continue;
    }
    if (!frontmatterDone) continue;

    // Fenced code blocks
    const fenceMatch = line.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!inFencedCode) { inFencedCode = true; fencePattern = fenceMatch[1]; }
      else if (line.startsWith(fencePattern)) { inFencedCode = false; fencePattern = null; }
      continue;
    }
    if (inFencedCode) continue;

    // Indented code (4+ spaces or tab at start)
    if (/^( {4}|\t)/.test(line)) continue;

    // Strip URLs so colons inside them don't trigger false positives
    const stripped = line.replace(/https?:\/\/\S+/g, "URL");

    // Find digit:digit not preceded by backslash
    const matches = [...stripped.matchAll(/(?<!\\)(\d):(\d)/g)];
    for (const m of matches) {
      hits.push({ line: lineNum, text: line.trim().substring(0, 100) });
      break; // one hit per line is enough
    }
  }

  return hits;
}

const files = walkDir(CONTENT_DIR);
let totalHits = 0;

for (const file of files.sort()) {
  const hits = check(file);
  if (hits.length) {
    const rel = file.replace(CONTENT_DIR + "/", "");
    console.log(`\n${rel}`);
    for (const h of hits) {
      console.log(`  L${h.line}: ${h.text}`);
    }
    totalHits += hits.length;
  }
}

if (totalHits === 0) {
  console.log("✓ No unescaped digit:digit colon patterns found.");
} else {
  console.log(`\n${totalHits} line(s) need \`\\:\` escaping.`);
  process.exit(1);
}
