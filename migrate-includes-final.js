#!/usr/bin/env node

/**
 * Final migration: Convert Jekyll includes to Astro components
 * Properly handles frontmatter placement
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, 'src/content/blog');

// Extract frontmatter from content
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { frontmatter: '', body: content };
  return {
    frontmatter: match[1],
    body: content.slice(match[0].length),
  };
}

// Parse Jekyll include attributes
function parseIncludeAttributes(match) {
  const attrs = {};
  const regex = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = regex.exec(match)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

// Convert fb_migrate includes
function convertFbMigrate(content) {
  const fbMigrateRegex = /\{%\s*include\s+fb_migrate\s+(.*?)\s*%\}/g;

  return content.replace(fbMigrateRegex, (match) => {
    const attrs = parseIncludeAttributes(match);
    if (attrs.fb_url && attrs.original_date) {
      return `<FbMigrate fb_url="${attrs.fb_url}" original_date="${attrs.original_date}" />`;
    }
    return match;
  });
}

// Convert figure includes
function convertFigure(content) {
  const figureRegex = /\{%\s*include\s+figure\s+(.*?)\s*%\}/g;

  return content.replace(figureRegex, (match) => {
    const attrs = parseIncludeAttributes(match);

    if (attrs.image_path && attrs.alt) {
      let caption = attrs.caption || '';
      // Escape quotes in caption for JSX
      caption = caption.replace(/"/g, '\\"');
      return `<Figure image_path="${attrs.image_path}" alt="${attrs.alt}" caption="${caption}" />`;
    }
    return match;
  });
}

const COMPONENT_STYLES = `<!-- Component Styles -->
<style>
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

// Main migration
function migrateFile(filePath) {
  const originalContent = fs.readFileSync(filePath, 'utf8');

  // Check if file has includes
  if (!originalContent.includes('{% include fb_migrate') && !originalContent.includes('{% include figure')) {
    return false;
  }

  // Extract frontmatter
  const { frontmatter, body } = extractFrontmatter(originalContent);

  // Convert includes
  let newBody = convertFbMigrate(body);
  newBody = convertFigure(newBody);

  // Check if any conversions happened
  if (newBody === body) {
    return false;
  }

  // Build imports
  let imports = '';
  if (originalContent.includes('{% include fb_migrate')) {
    imports += "import FbMigrate from '@/components/FbMigrate.astro';\n";
  }
  if (originalContent.includes('{% include figure')) {
    imports += "import Figure from '@/components/Figure.astro';\n";
  }

  // Reconstruct file
  const newContent = `---\n${frontmatter}\n---\n\n${imports}\n${COMPONENT_STYLES}\n\n${newBody}`;

  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

// Process all markdown files
console.log('🔄 Migrating Jekyll includes to Astro components (Option 2)...\n');

const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md')).sort();

let migratedCount = 0;
const migratedFiles = [];

for (const file of files) {
  const filePath = path.join(BLOG_DIR, file);
  if (migrateFile(filePath)) {
    console.log(`✓ ${file}`);
    migratedCount++;
    migratedFiles.push(file);
  }
}

console.log(`\n✅ Migration complete! ${migratedCount} files updated.\n`);

if (migratedCount > 0) {
  console.log('📋 Migrated files:');
  migratedFiles.forEach((f) => console.log(`   - ${f}`));
  console.log('\n📝 Next steps:');
  console.log('   1. npm run build  (to compile with components)');
  console.log('   2. npm run dev    (to preview in development)');
}
