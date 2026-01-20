#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

// Files to clean up
const FILES_TO_FIX = [
  '2018-10-20-my-morning-routine.mdx',
  '2020-06-08-happy-third-lowcarbiversary.mdx',
  '2021-01-18-two-guys-watch-a-burning-house.mdx',
  '2021-01-19-my-hero-karen.mdx',
  '2021-01-19-shinleaf-campsite.mdx',
  '2021-01-30-gratitude-and-that-s-right.mdx',
];

function removeStyleBlocks(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

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
  const body = lines.slice(fmEnd + 1).join('\n');

  // Remove style blocks: {/* ... */}\n<style>......</style>
  let cleanBody = body.replace(/\{\/\*[^*]*\*\/\}\n<style>[\s\S]*?<\/style>\n*/g, '');
  
  // Also remove orphaned JSX comments that were before style blocks
  cleanBody = cleanBody.replace(/\{\/\*\s*Component\s*Styles\s*\*\/\}\n*/g, '');

  // Trim leading whitespace
  cleanBody = cleanBody.trimStart();

  // Reconstruct the file
  const newContent = frontmatter + '\n' + cleanBody;
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// Main
console.log('🔧 Removing style blocks from MDX...\n');

let fixedCount = 0;
for (const file of FILES_TO_FIX) {
  const filePath = path.join(BLOG_DIR, file);
  if (fs.existsSync(filePath)) {
    if (removeStyleBlocks(filePath)) {
      console.log(`✓ ${file}`);
      fixedCount++;
    }
  }
}

console.log(`\n✅ Cleaned ${fixedCount} files.`);
