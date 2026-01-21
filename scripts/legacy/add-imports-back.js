#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

// Files to add imports to
const FILES_TO_FIX = [
  { file: '2018-10-20-my-morning-routine.mdx', imports: ['Figure'] },
  { file: '2020-06-08-happy-third-lowcarbiversary.mdx', imports: ['Figure'] },
  { file: '2021-01-18-two-guys-watch-a-burning-house.mdx', imports: ['Figure', 'FbMigrate'] },
  { file: '2021-01-19-my-hero-karen.mdx', imports: ['Figure'] },
  { file: '2021-01-19-shinleaf-campsite.mdx', imports: ['Figure'] },
  { file: '2021-01-30-gratitude-and-that-s-right.mdx', imports: ['FbMigrate'] },
];

function addImports(filePath, imports) {
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

  // Create import statements
  const importStatements = imports.map(comp => 
    `import ${comp} from '@/components/${comp}.astro';`
  ).join('\n');

  // Reconstruct the file with imports right after frontmatter
  const newContent = frontmatter + '\n' + importStatements + '\n' + body;
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// Main
console.log('➕ Adding imports to MDX files...\n');

let fixedCount = 0;
for (const item of FILES_TO_FIX) {
  const filePath = path.join(BLOG_DIR, item.file);
  if (fs.existsSync(filePath)) {
    if (addImports(filePath, item.imports)) {
      console.log(`✓ ${item.file} (${item.imports.join(', ')})`);
      fixedCount++;
    }
  }
}

console.log(`\n✅ Added imports to ${fixedCount} files.`);
