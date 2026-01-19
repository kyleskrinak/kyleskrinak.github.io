#!/usr/bin/env node

/**
 * Migrate Jekyll includes to Astro components
 * Converts:
 * - {% include fb_migrate ... %} → <FbMigrate ... />
 * - {% include figure ... %} → <Figure ... />
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BLOG_DIR = path.join(__dirname, 'src/content/blog');

// Helper to parse Jekyll include attributes
function parseIncludeAttributes(match) {
  const attrs = {};
  const regex = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = regex.exec(match)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

// Migrate fb_migrate includes
function migrateFbMigrate(content) {
  const fbMigrateRegex = /\{%\s*include\s+fb_migrate\s+(.*?)\s*%\}/g;

  return content.replace(fbMigrateRegex, (match) => {
    const attrs = parseIncludeAttributes(match);
    if (attrs.fb_url && attrs.original_date) {
      return `<FbMigrate fb_url="${attrs.fb_url}" original_date="${attrs.original_date}" />`;
    }
    return match; // Return original if parsing fails
  });
}

// Migrate figure includes
function migrateFigure(content) {
  const figureRegex = /\{%\s*include\s+figure\s+(.*?)\s*%\}/g;

  return content.replace(figureRegex, (match) => {
    const attrs = parseIncludeAttributes(match);

    if (attrs.image_path && attrs.alt) {
      let caption = attrs.caption || '';

      // Escape quotes in caption
      caption = caption.replace(/"/g, '\\"');

      // Check if caption contains HTML
      if (caption.includes('<')) {
        // For HTML captions, we'll need to handle them specially
        // Return a JSX-style caption (will need manual review)
        return `<Figure image_path="${attrs.image_path}" alt="${attrs.alt}" caption="${caption}" />`;
      } else {
        return `<Figure image_path="${attrs.image_path}" alt="${attrs.alt}" caption="${caption}" />`;
      }
    }
    return match; // Return original if parsing fails
  });
}

// Main migration
function migrateIncludes(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Add import statements if includes are found
  const hasFbMigrate = content.includes('{% include fb_migrate');
  const hasFigure = content.includes('{% include figure');

  // Migrate the includes
  content = migrateFbMigrate(content);
  content = migrateFigure(content);

  // Add imports at the top if needed (after front matter)
  if ((hasFbMigrate || hasFigure) && content !== originalContent) {
    const frontMatterEnd = content.indexOf('\n---\n', 4) + 5;

    let imports = '';
    if (hasFbMigrate) imports += "import FbMigrate from '@/components/FbMigrate.astro';\n";
    if (hasFigure) imports += "import Figure from '@/components/Figure.astro';\n";

    if (imports) {
      content = content.slice(0, frontMatterEnd) + imports + '\n' + content.slice(frontMatterEnd);
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

// Process all markdown files
console.log('🔄 Migrating Jekyll includes to Astro components...\n');

const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));

let migratedCount = 0;

for (const file of files) {
  const filePath = path.join(BLOG_DIR, file);
  if (migrateIncludes(filePath)) {
    console.log(`✓ ${file}`);
    migratedCount++;
  }
}

console.log(`\n✅ Migration complete! ${migratedCount} files updated.`);

if (migratedCount > 0) {
  console.log('\n📝 Review the following:');
  console.log('   - HTML captions may need manual adjustment');
  console.log('   - Verify all images are displaying correctly');
  console.log('   - Check component imports are correct');
}
