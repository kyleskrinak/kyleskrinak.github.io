#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

function fixCategories(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove empty category entries: "  - \n" or "  -\n"
  content = content.replace(/^  -\s*$/gm, '');

  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

// Main
console.log('🔧 Removing empty categories...\n');

let count = 0;
const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

for (const file of files) {
  const filePath = path.join(BLOG_DIR, file);
  if (fixCategories(filePath)) {
    count++;
  }
}

console.log(`✅ Fixed ${count} files.`);
