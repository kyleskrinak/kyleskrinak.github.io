#!/usr/bin/env node
/**
 * Detects digit:digit patterns in markdown/MDX content that remark-directive
 * would silently consume as inline directives, causing text to disappear.
 *
 * Skips: fenced code blocks, indented code, blockquote-indented code,
 * frontmatter, inline code spans, URLs, already-escaped colons.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src/content/blog');

function walkDir(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walkDir(full));
    else if (entry.endsWith('.md') || entry.endsWith('.mdx')) files.push(full);
  }
  return files;
}

// Blockquote marker(s) followed by 4+ spaces or a tab of additional indentation —
// a code block nested inside a blockquote, which remark-directive never touches.
const BLOCKQUOTE_CODE_RE = /^(?:\s{0,3}>\s?)+(?: {4,}|\t)/;

export function checkContent(raw) {
  const lines = raw.split('\n');
  const hits = [];

  let inFrontmatter = false;
  let frontmatterDone = lines[0]?.trimEnd() !== '---';
  let inFencedCode = false;
  let fencePattern = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Frontmatter
    if (lineNum === 1 && line.trimEnd() === '---') { inFrontmatter = true; continue; }
    if (inFrontmatter) {
      if (line.trimEnd() === '---') { inFrontmatter = false; frontmatterDone = true; }
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

    // Blockquote-indented code
    if (BLOCKQUOTE_CODE_RE.test(line)) continue;

    // Strip URLs so colons inside them don't trigger false positives
    let stripped = line.replace(/https?:\/\/\S+/g, 'URL');

    // Strip inline code spans (doesn't handle double-backtick spans)
    stripped = stripped.replace(/`[^`]*`/g, '');

    // Find digit:digit not already escaped
    const matches = [...stripped.matchAll(/\d:\d/g)];
    for (const m of matches) {
      hits.push({ line: lineNum, text: line.trim().substring(0, 100) });
      break; // one hit per line is enough
    }
  }

  return hits;
}

function main() {
  const files = walkDir(CONTENT_DIR);
  let totalHits = 0;

  for (const file of files.sort()) {
    const hits = checkContent(readFileSync(file, 'utf8'));
    if (hits.length) {
      const rel = file.replace(CONTENT_DIR + '/', '');
      console.log(`\n${rel}`);
      for (const h of hits) {
        console.log(`  L${h.line}: ${h.text}`);
      }
      totalHits += hits.length;
    }
  }

  if (totalHits === 0) {
    console.log('✓ No unescaped digit:digit colon patterns found.');
  } else {
    console.log(`\n${totalHits} line(s) need \`\\:\` escaping.`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
