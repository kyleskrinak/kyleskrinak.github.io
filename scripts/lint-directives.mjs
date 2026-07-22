#!/usr/bin/env node
/**
 * Detects unescaped ':' immediately followed by an alphanumeric — remark-directive
 * parses these as inline directives and silently deletes the text.
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
  let inStyleBlock = false;

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

    // Raw <style> HTML blocks — CommonMark treats these as unparsed HTML,
    // so CSS pseudo-classes like `a:hover` never reach remark-directive.
    if (inStyleBlock) {
      if (/<\/style\s*>/.test(line)) inStyleBlock = false;
      continue;
    }
    if (/^\s*<style(\s[^>]*)?>/.test(line)) {
      if (!/<\/style\s*>/.test(line)) inStyleBlock = true;
      continue;
    }

    // MDX import declarations — compiled as JS, not parsed by remark-directive
    if (/^import\s.+\sfrom\s+['"][^'"]+['"];?\s*$/.test(line)) continue;

    // Fenced code blocks (fences may be indented 0-3 spaces and/or sit
    // inside a blockquote)
    const fenceLine = line.replace(/^(?:\s{0,3}>\s?)+/, '');
    const fenceMatch = fenceLine.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!inFencedCode) { inFencedCode = true; fencePattern = fenceMatch[1]; }
      else if (fenceLine.trimStart().startsWith(fencePattern)) { inFencedCode = false; fencePattern = null; }
      continue;
    }
    if (inFencedCode) continue;

    // Indented code (4+ spaces or tab at start)
    if (/^( {4}|\t)/.test(line)) continue;

    // Blockquote-indented code
    if (BLOCKQUOTE_CODE_RE.test(line)) continue;

    // Strip URLs so colons inside them don't trigger false positives
    let stripped = line.replace(/https?:\/\/\S+/g, 'URL');

    // Strip markdown link destinations: [text](dest "title") → [text](URL)
    stripped = stripped.replace(/\]\([^)]*\)/g, '](URL)');

    // Strip inline code spans (doesn't handle double-backtick spans)
    stripped = stripped.replace(/`[^`]*`/g, '');

    // Strip raw HTML tags so attribute values (style="margin: 0") don't trigger
    stripped = stripped.replace(/<[^>]+>/g, '');

    // Skip directive fence lines (:::cards etc.)
    if (/^\s*::/.test(stripped)) continue;

    // Any colon immediately followed by an alphanumeric becomes an inline
    // directive and eats text — unless escaped (\:) or part of :: syntax.
    if (/(?<![\\:]):(?=[A-Za-z0-9])/.test(stripped)) {
      hits.push({ line: lineNum, text: line.trim().substring(0, 100) });
    }
  }

  if (inFrontmatter) {
    hits.push({ line: 1, text: 'unclosed frontmatter block — file was not linted' });
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
    console.log('✓ No unescaped directive-like colon patterns found.');
  } else {
    console.log(`\n${totalHits} line(s) need \`\\:\` escaping.`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
