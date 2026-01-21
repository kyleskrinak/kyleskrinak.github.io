#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

function fixBrokenCategories(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let output = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // If this is the start of frontmatter or not a categories line
    if (!line.startsWith('categories')) {
      output.push(line);
      i++;
      continue;
    }
    
    // Found a categories line
    const categoriesMatch = line.match(/^categories:\s*(.*)/);
    if (categoriesMatch) {
      const value = categoriesMatch[1].trim();
      
      if (value === '[]' || value === '' || value === 'null') {
        // This is an empty categories line
        // Check if there are list items on following lines
        let j = i + 1;
        while (j < lines.length && (lines[j].match(/^\s+-\s/) || lines[j].trim() === '')) {
          j++;
        }
        // Skip all those lines and just add an empty categories
        output.push('categories: []');
        i = j;
        continue;
      }
    }
    
    output.push(line);
    i++;
  }
  
  const newContent = output.join('\n');
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// Main
console.log('🔧 Fixing broken categories...\n');

let count = 0;
const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

for (const file of files) {
  const filePath = path.join(BLOG_DIR, file);
  if (fixBrokenCategories(filePath)) {
    count++;
  }
}

console.log(`✅ Fixed ${count} files.`);
