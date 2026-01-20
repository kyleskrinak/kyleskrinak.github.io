#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

// Files that have import statements to remove
const FILES_TO_FIX = [
  '2018-10-20-my-morning-routine.mdx',
  '2020-06-08-happy-third-lowcarbiversary.mdx',
  '2021-01-18-two-guys-watch-a-burning-house.mdx',
  '2021-01-19-my-hero-karen.mdx',
  '2021-01-19-shinleaf-campsite.mdx',
  '2021-01-30-gratitude-and-that-s-right.mdx',
];

function fixMDXFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Split into frontmatter and body
  const lines = content.split('\n');
  let fmEnd = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      fmEnd = i;
      break;
    }
  }

  const frontmatter = lines.slice(0, fmEnd + 1).join('\n');
  let body = lines.slice(fmEnd + 1).join('\n');

  // Remove import statements and leading empty lines
  body = body.replace(/^import\s+.+?\s+from\s+['"].+?['"];?\n*/gm, '');

  // Trim leading whitespace
  body = body.trimStart();

  // Reconstruct the file
  const newContent = frontmatter + '\n' + body;
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// Main
console.log('🔧 Fixing MDX imports...\n');

let fixedCount = 0;
for (const file of FILES_TO_FIX) {
  const filePath = path.join(BLOG_DIR, file);
  if (fs.existsSync(filePath)) {
    if (fixMDXFile(filePath)) {
      console.log(`✓ ${file}`);
      fixedCount++;
    }
  }
}

console.log(`\n✅ Fixed ${fixedCount} files.`);
