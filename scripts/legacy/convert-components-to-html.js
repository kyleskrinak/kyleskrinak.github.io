#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

// Files to process
const FILES_TO_FIX = [
  '2018-10-20-my-morning-routine.md',
  '2020-06-08-happy-third-lowcarbiversary.md',
  '2021-01-18-two-guys-watch-a-burning-house.md',
  '2021-01-19-my-hero-karen.md',
  '2021-01-19-shinleaf-campsite.md',
  '2021-01-30-gratitude-and-that-s-right.md',
];

const STYLES = `<style>
.notice {
  padding: 1rem;
  margin-bottom: 1.5rem;
  border-left: 4px solid #3498db;
  background-color: #ecf0f1;
  border-radius: 0 3px 3px 0;
}

.notice--info {
  border-left-color: #3498db;
  background-color: #d5edf7;
}

.notice em {
  display: block;
}

.notice strong {
  font-weight: 700;
}

.notice a {
  color: #0366d6;
  text-decoration: none;
}

.notice a:hover {
  text-decoration: underline;
}

.figure {
  margin: 1.5rem 0;
  text-align: center;
}

.figure__image {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  display: block;
  margin-bottom: 0.75rem;
}

.figure__caption {
  font-size: 0.9em;
  color: #666;
  font-style: italic;
  padding: 0 1rem;
}

.figure__caption a {
  color: #0366d6;
  text-decoration: none;
}

.figure__caption a:hover {
  text-decoration: underline;
}
</style>`;

function convertComponentsToHtml(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if we already have styles added
  if (content.includes('<style>')) {
    console.log(`  (styles already present)`);
    return false;
  }

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

  // Remove import statements
  body = body.replace(/^import\s+.+?\s+from\s+['"].+?['"];?\n*/gm, '');
  body = body.trimStart();

  // Convert <Figure ... /> to HTML
  body = body.replace(
    /<Figure\s+image_path="([^"]*)"\s+alt="([^"]*)"\s+caption="([^"]*)"\s*\/>/g,
    (match, imagePath, alt, caption) => {
      return `<figure class="figure">
<img src="${imagePath}" alt="${alt}" class="figure__image" />
<figcaption class="figure__caption">${caption}</figcaption>
</figure>`;
    }
  );

  // Handle Figure without caption
  body = body.replace(
    /<Figure\s+image_path="([^"]*)"\s+alt="([^"]*)"\s*\/>/g,
    (match, imagePath, alt) => {
      return `<figure class="figure">
<img src="${imagePath}" alt="${alt}" class="figure__image" />
</figure>`;
    }
  );

  // Convert <FbMigrate ... /> to HTML
  body = body.replace(
    /<FbMigrate\s+fb_url="([^"]*)"\s+original_date="([^"]*)"\s*\/>/g,
    (match, fbUrl, originalDate) => {
      return `<div class="notice notice--info">
<em>
<strong>Note:</strong>
I originally posted this on my Facebook account on
<a href="${fbUrl}">${originalDate}</a>. However, Facebook is getting rid of
their "notes" blog-like ability, so I've moved this content to my blog, with
some edits for clarity.
</em>
</div>`;
    }
  );

  // Reconstruct the file with styles at the end of frontmatter
  const newContent = frontmatter + '\n\n' + STYLES + '\n\n' + body;
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// Main
console.log('🔄 Converting Astro components to HTML...\n');

let convertedCount = 0;
for (const file of FILES_TO_FIX) {
  const filePath = path.join(BLOG_DIR, file);
  if (fs.existsSync(filePath)) {
    if (convertComponentsToHtml(filePath)) {
      console.log(`✓ ${file}`);
      convertedCount++;
    }
  }
}

console.log(`\n✅ Converted ${convertedCount} files.`);
