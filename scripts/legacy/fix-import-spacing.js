#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

// Files to fix
const FILES_TO_FIX = [
  '2018-10-20-my-morning-routine.mdx',
  '2020-06-08-happy-third-lowcarbiversary.mdx',
  '2021-01-18-two-guys-watch-a-burning-house.mdx',
  '2021-01-19-my-hero-karen.mdx',
  '2021-01-19-shinleaf-campsite.mdx',
  '2021-01-30-gratitude-and-that-s-right.mdx',
];

function fixImportSpacing(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Find frontmatter end
  const lines = content.split('\n');
  let fmEnd = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      fmEnd = i;
      break;
    }
  }

  // Find imports
  let importEnd = fmEnd + 1;
  for (let i = fmEnd + 1; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      importEnd = i + 1;
    } else if (lines[i].trim() === '') {
      // Skip empty lines after imports
      importEnd = i + 1;
    } else {
      // Stop when we hit non-import content
      break;
    }
  }

  // Ensure there's a blank line between imports and content
  const before = lines.slice(0, importEnd);
  const after = lines.slice(importEnd);
  
  // Remove leading empty lines from after
  while (after.length > 0 && after[0].trim() === '') {
    after.shift();
  }

  // Reconstruct with proper spacing
  const newLines = [...before];
  if (after.length > 0) {
    newLines.push(''); // Add blank line after imports
    newLines.push(...after);
  }

  const newContent = newLines.join('\n');
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// Main
console.log('🔧 Fixing import spacing in MDX files...\n');

let fixedCount = 0;
for (const file of FILES_TO_FIX) {
  const filePath = path.join(BLOG_DIR, file);
  if (fs.existsSync(filePath)) {
    if (fixImportSpacing(filePath)) {
      console.log(`✓ ${file}`);
      fixedCount++;
    }
  }
}

console.log(`\n✅ Fixed ${fixedCount} files.`);
