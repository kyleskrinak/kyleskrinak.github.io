#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

// Image filename to alt text mapping (we'll auto-generate if missing)
const imageAltMap = {
  'drupal_logo.png': 'Drupal logo',
  'flatpanbake.jpg': 'Flat pan bake',
  'confusedmeme.jpg': 'Confused meme',
  'empty_dining.jpg': 'Empty dining room',
  'hot_tub.jpg': 'Hot tub',
  '190111-historical-dress.JPG': 'Historical dress',
  '1992-05-CRN.jpg': 'Photo from May 1992',
};

function updateBlogPostImages(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find and extract frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return false;

  let [, frontmatterStr, body] = match;
  const lines = frontmatterStr.split('\n');
  
  let updated = false;
  const newLines = [];
  let imageFound = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for image: /assets/images/filename.png
    if (line.match(/^image:\s+\/assets\/images\/(.+)$/)) {
      const imageMatch = line.match(/^image:\s+\/assets\/images\/(.+)$/);
      const filename = imageMatch[1];
      
      // Convert to relative path for src/assets/images
      const relativePath = `../../assets/images/${filename}`;
      
      // Get alt text
      const altText = imageAltMap[filename] || filename.replace(/[_-]/g, ' ').replace(/\.[^/.]+$/, '');
      
      newLines.push(`image: ${relativePath}`);
      newLines.push(`alt: "${altText}"`);
      
      // Add source tag if not already present
      if (!frontmatterStr.includes('source:')) {
        newLines.push(`source: jekyll`);
      }
      
      imageFound = true;
      updated = true;
    } else {
      newLines.push(line);
    }
  }

  if (!updated) return false;

  const newFrontmatter = newLines.join('\n');
  const newContent = `---\n${newFrontmatter}\n---\n${body}`;
  
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// Main
console.log('🖼️  Migrating images to src/assets/ with Astro optimization...\n');

let count = 0;
const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

for (const file of files) {
  const filePath = path.join(BLOG_DIR, file);
  if (updateBlogPostImages(filePath)) {
    console.log(`✓ ${file}`);
    count++;
  }
}

console.log(`\n✅ Updated ${count} blog posts with image paths.`);
