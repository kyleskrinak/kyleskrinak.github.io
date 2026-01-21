#!/usr/bin/env node

/**
 * Normalize Jekyll frontmatter to Astro format
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

// Files that need normalization
const FILES_TO_NORMALIZE = [
  '2018-10-20-my-morning-routine.md',
  '2020-06-08-happy-third-lowcarbiversary.md',
  '2021-01-18-two-guys-watch-a-burning-house.md',
  '2021-01-19-my-hero-karen.md',
  '2021-01-19-shinleaf-campsite.md',
  '2021-01-30-gratitude-and-that-s-right.md',
];

function extractFrontmatterLines(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { lines: [], body: content };

  return {
    lines: match[1].split('\n'),
    body: content.slice(match[0].length),
  };
}

function normalizeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { lines, body } = extractFrontmatterLines(content);

  if (lines.length === 0) return false;

  const astroYaml = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Parse key-value pairs
    const keyValueMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyValueMatch) {
      const [, key, value] = keyValueMatch;

      if (key === 'layout' || key === 'toc' || key === 'toc_sticky' || key === 'hidden') {
        // Skip Jekyll-specific fields
        i++;
        continue;
      }

      if (key === 'title') {
        astroYaml.title = value;
      } else if (key === 'excerpt') {
        astroYaml.description = value;
      } else if (key === 'date') {
        // Extract just the date part: "2018-10-20 13:41 -0400" → "2018-10-20T00:00:00.000Z"
        const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          astroYaml.pubDate = new Date(dateMatch[1] + 'T00:00:00.000Z').toISOString();
        }
      } else if (key === 'category') {
        // Handle as list
        astroYaml.categories = [value];
        // Check if next lines are continuations (YAML list)
        i++;
        while (i < lines.length && lines[i].match(/^  - /)) {
          const item = lines[i].match(/^  - (.*)$/);
          if (item) astroYaml.categories.push(item[1]);
          i++;
        }
        i--; // Back up one since loop will increment
      } else if (key === 'header') {
        // Skip header, we'll handle overlay_image separately
      } else if (key === 'image') {
        astroYaml.image = value;
      } else if (key.match(/^\s+overlay_image/)) {
        // Parse nested overlay_image
        const imageMatch = line.match(/overlay_image:\s*(.+)$/);
        if (imageMatch) astroYaml.image = imageMatch[1];
      }
    }

    i++;
  }

  // Defaults
  if (!astroYaml.title) astroYaml.title = 'Untitled';
  if (!astroYaml.pubDate) astroYaml.pubDate = new Date().toISOString();
  if (!astroYaml.description) astroYaml.description = '';
  if (!astroYaml.categories) astroYaml.categories = [];

  // Rebuild frontmatter
  const newFrontmatter = ['---'];
  Object.entries(astroYaml).forEach(([key, value]) => {
    if (key === 'categories' || key === 'tags') {
      if (Array.isArray(value) && value.length > 0) {
        newFrontmatter.push(`${key}:`);
        value.forEach((item) => {
          newFrontmatter.push(`  - ${item}`);
        });
      }
    } else if (value) {
      newFrontmatter.push(`${key}: ${value}`);
    }
  });
  newFrontmatter.push('---\n');

  const newContent = newFrontmatter.join('\n') + body;
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// Main
console.log('🔄 Normalizing Jekyll frontmatter to Astro format...\n');

let normalizedCount = 0;
for (const file of FILES_TO_NORMALIZE) {
  const filePath = path.join(BLOG_DIR, file);
  if (fs.existsSync(filePath)) {
    if (normalizeFile(filePath)) {
      console.log(`✓ ${file}`);
      normalizedCount++;
    }
  }
}

console.log(`\n✅ Normalization complete! ${normalizedCount} files updated.`);
