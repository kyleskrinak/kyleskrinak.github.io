#!/usr/bin/env node
/**
 * Detects remark-directive syntax that would corrupt rendered content.
 *
 * Parses each file with the same micromark/mdast stack the build uses
 * (micromark-extension-directive, plus the mdxjs extensions for .mdx), so
 * anything the build's parser treats as a directive is flagged here — no
 * heuristics for code blocks, lists, HTML, or MDX constructs.
 *
 * Flagged: every textDirective and leafDirective (the only sanctioned syntax
 * is the `cards` container), and any containerDirective not in the allowlist.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { directive } from 'micromark-extension-directive';
import { directiveFromMarkdown } from 'mdast-util-directive';
import { mdxjs } from 'micromark-extension-mdxjs';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { visit } from 'unist-util-visit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src/content');

const ALLOWED_CONTAINER_DIRECTIVES = new Set(['cards']);

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

// Split off YAML frontmatter (no frontmatter micromark extension is installed;
// the build strips it before markdown parsing too). Returns the body to parse
// and the number of lines removed, so reported line numbers match the file.
function stripFrontmatter(raw) {
  const lines = raw.split('\n');
  if (lines[0]?.trimEnd() !== '---') return { body: raw, offset: 0 };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === '---') {
      return { body: lines.slice(i + 1).join('\n'), offset: i + 1 };
    }
  }
  return { body: null, offset: 0 }; // unclosed frontmatter
}

export function checkContent(raw, { mdx = false } = {}) {
  const { body, offset } = stripFrontmatter(raw);
  if (body === null) {
    return [{ line: 1, text: 'unclosed frontmatter block — file was not linted' }];
  }

  let tree;
  try {
    // gfm() matches the build's remark-gfm default — without it, autolink
    // literals aren't recognized and a colon in a bare URL path would be
    // misreported as a directive.
    tree = fromMarkdown(body, {
      extensions: mdx ? [directive(), gfm(), mdxjs()] : [directive(), gfm()],
      mdastExtensions: mdx
        ? [directiveFromMarkdown(), gfmFromMarkdown(), mdxFromMarkdown()]
        : [directiveFromMarkdown(), gfmFromMarkdown()],
    });
  } catch (err) {
    const parseLine = (err.place?.line ?? err.line ?? 1) + offset;
    return [{ line: parseLine, text: `parse error — ${err.reason ?? err.message}` }];
  }

  const bodyLines = body.split('\n');
  const hits = [];
  visit(tree, node => {
    const isBadDirective =
      node.type === 'textDirective' ||
      node.type === 'leafDirective' ||
      (node.type === 'containerDirective' && !ALLOWED_CONTAINER_DIRECTIVES.has(node.name));
    if (!isBadDirective) return;

    const bodyLine = node.position?.start.line ?? 1;
    hits.push({
      line: bodyLine + offset,
      text: (bodyLines[bodyLine - 1] ?? '').trim().substring(0, 100),
    });
  });

  // visit() is pre-order, so nested directives can report out of line order.
  return hits.sort((a, b) => a.line - b.line);
}

function main() {
  const files = walkDir(CONTENT_DIR);
  let totalHits = 0;

  for (const file of files.sort()) {
    const hits = checkContent(readFileSync(file, 'utf8'), { mdx: file.endsWith('.mdx') });
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
    console.log(`\n${totalHits} line(s) need \`\\:\` escaping or directive cleanup.`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
