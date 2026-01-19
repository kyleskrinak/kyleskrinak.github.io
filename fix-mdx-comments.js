#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

// Files that have HTML comments to fix
const FILES_TO_FIX = [
  '2018-10-20-my-morning-routine.mdx',
  '2020-06-08-happy-third-lowcarbiversary.mdx',
  '2021-01-18-two-guys-watch-a-burning-house.mdx',
  '2021-01-19-my-hero-karen.mdx',
  '2021-01-19-shinleaf-campsite.mdx',
  '2021-01-30-gratitude-and-that-s-right.mdx',
];

function fixMDXComments(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace HTML comments with JSX comments
  // <!-- Comment --> becomes {/* Comment */}
  content = content.replace(/<!-- ([\s\S]*?) -->/g, '{/* $1 */}');

  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

// Main
console.log('🔧 Fixing MDX HTML comments...\n');

let fixedCount = 0;
for (const file of FILES_TO_FIX) {
  const filePath = path.join(BLOG_DIR, file);
  if (fs.existsSync(filePath)) {
    if (fixMDXComments(filePath)) {
      console.log(`✓ ${file}`);
      fixedCount++;
    }
  }
}

console.log(`\n✅ Fixed ${fixedCount} files.`);
