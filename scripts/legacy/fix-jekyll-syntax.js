#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

// Files that have Jekyll syntax to remove
const FILES_TO_FIX = [
  '2018-10-20-my-morning-routine.mdx',
  '2020-06-08-happy-third-lowcarbiversary.mdx',
  '2021-01-18-two-guys-watch-a-burning-house.mdx',
  '2021-01-19-my-hero-karen.mdx',
  '2021-01-19-shinleaf-campsite.mdx',
  '2021-01-30-gratitude-and-that-s-right.mdx',
];

function fixJekyllSyntax(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove Jekyll-specific attribute syntax: {: .class-name }
  content = content.replace(/\n\{:[^}]*\}/g, '');

  // Remove Jekyll liquid tags and variables like {{ site.baseurl }}
  // Replace with just the path part
  content = content.replace(/\{\{\s*site\.baseurl\s*\}}/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

// Main
console.log('🔧 Removing Jekyll-specific syntax...\n');

let fixedCount = 0;
for (const file of FILES_TO_FIX) {
  const filePath = path.join(BLOG_DIR, file);
  if (fs.existsSync(filePath)) {
    if (fixJekyllSyntax(filePath)) {
      console.log(`✓ ${file}`);
      fixedCount++;
    }
  }
}

console.log(`\n✅ Fixed ${fixedCount} files.`);
