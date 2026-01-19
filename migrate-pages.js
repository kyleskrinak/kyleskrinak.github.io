#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Configuration
const JEKYLL_PAGES_DIR = '/Users/kyleskrinak/Documents/jekyll-blog/_pages/';
const ASTRO_PAGES_DIR = '/Users/kyleskrinak/Documents/astro-blog/src/content/pages/';

// Statistics
const stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  errors: [],
  archiveFiles: [],
  htmlFiles: []
};

/**
 * Fix HTML entities in text
 */
function fixHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&#58;/g, ':')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Convert Jekyll image paths from {{ site.baseurl }} to plain paths
 */
function convertImagePaths(content) {
  if (!content) return content;

  // Replace {{ site.baseurl }} with empty string
  return content.replace(/\{\{\s*site\.baseurl\s*\}}/g, '');
}

/**
 * Convert Jekyll figure includes to standard markdown
 */
function convertFigureIncludes(content) {
  if (!content) return content;

  // Convert {% include figure ... %} to markdown image syntax
  // Pattern: {% include figure image_path="path" alt="alt text" caption="caption" %}
  return content.replace(
    /\{%\s*include\s+figure\s+image_path="([^"]+)"\s+alt="([^"]*)"\s+caption="([^"]*)"\s*%\}/g,
    (match, imagePath, alt, caption) => {
      const cleanPath = imagePath.replace(/\{\{\s*site\.baseurl\s*\}}/g, '');
      if (caption) {
        return `![${alt}](${cleanPath})\n*${caption}*`;
      }
      return `![${alt}](${cleanPath})`;
    }
  );
}

/**
 * Convert Jekyll front matter to Astro format for pages
 */
function convertFrontMatter(jekyllData, filename) {
  const astroData = {};

  // Required fields
  if (jekyllData.title) {
    astroData.title = fixHtmlEntities(jekyllData.title);
  }

  // Author - default to Kyle Skrinak for pages
  astroData.author = jekyllData.author || 'Kyle Skrinak';

  // Keep permalink if it exists
  if (jekyllData.permalink) {
    astroData.permalink = jekyllData.permalink;
  }

  // Handle table of contents - default to false for pages
  astroData.toc = jekyllData.toc === true ? true : false;

  // Optional fields that might exist
  if (jekyllData.description) {
    astroData.description = fixHtmlEntities(jekyllData.description);
  }

  if (jekyllData.excerpt) {
    astroData.excerpt = fixHtmlEntities(jekyllData.excerpt);
  }

  if (jekyllData.comments !== undefined) {
    astroData.comments = jekyllData.comments;
  }

  // Store header image info if present
  if (jekyllData.header && jekyllData.header.overlay_image) {
    astroData.image = jekyllData.header.overlay_image;
  }

  // Handle categories if present
  if (jekyllData.categories) {
    if (Array.isArray(jekyllData.categories)) {
      astroData.categories = jekyllData.categories.map(c => c.trim()).filter(c => c.length > 0);
    } else if (typeof jekyllData.categories === 'string') {
      astroData.categories = [jekyllData.categories.trim()];
    }
  }

  // Handle tags if present
  if (jekyllData.tags) {
    if (Array.isArray(jekyllData.tags)) {
      astroData.tags = jekyllData.tags.map(t => t.trim()).filter(t => t.length > 0);
    } else if (typeof jekyllData.tags === 'string') {
      astroData.tags = [jekyllData.tags.trim()];
    }
  }

  // Handle redirect_from if present
  if (jekyllData.redirect_from) {
    astroData.redirect_from = jekyllData.redirect_from;
  }

  return astroData;
}

/**
 * Read and migrate a single Jekyll page
 */
function migratePage(filename) {
  const filePath = path.join(JEKYLL_PAGES_DIR, filename);
  const isHtmlFile = filename.endsWith('.html');

  try {
    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Check if this is an archive file
    if (isHtmlFile && (filename === 'archive.html' || filename.includes('archive'))) {
      stats.archiveFiles.push({
        file: filename,
        note: 'Archive pages are dynamically generated in Astro. Create a dedicated archive page route if needed.'
      });
      stats.skipped++;
      console.log(`⊘ Archive file (not migrated): ${filename}`);
      return;
    }

    // Parse front matter
    const { data: jekyllData, content: jekyllContent } = matter(fileContent);

    // Skip pages with layout: reveal (presentations)
    if (jekyllData.layout === 'reveal') {
      stats.skipped++;
      console.log(`⊘ Skipped presentation page: ${filename}`);
      return;
    }

    // Convert front matter to Astro format
    const astroData = convertFrontMatter(jekyllData, filename);

    // Convert content
    let astroContent = convertImagePaths(jekyllContent);
    astroContent = convertFigureIncludes(astroContent);

    // Build the new file with markdown extension
    let output = '---\n';

    // Write YAML front matter in a nice format
    Object.entries(astroData).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        output += `${key}:\n`;
        if (value.length > 0) {
          value.forEach(item => {
            output += `  - ${JSON.stringify(item)}\n`;
          });
        } else {
          output += `  []\n`;
        }
      } else if (typeof value === 'string' && (value.includes('\n') || value.includes('"'))) {
        output += `${key}: ${JSON.stringify(value)}\n`;
      } else if (typeof value === 'string') {
        output += `${key}: ${value}\n`;
      } else if (typeof value === 'boolean') {
        output += `${key}: ${value}\n`;
      } else if (value !== null && value !== undefined) {
        output += `${key}: ${JSON.stringify(value)}\n`;
      }
    });

    output += '---\n\n';
    output += astroContent;

    // Convert HTML files to .md extension for Astro
    let destFilename = filename;
    if (isHtmlFile) {
      destFilename = filename.replace(/\.html$/, '.md');
      stats.htmlFiles.push(filename);
    }

    // Write to Astro pages directory
    const destPath = path.join(ASTRO_PAGES_DIR, destFilename);
    fs.writeFileSync(destPath, output, 'utf-8');

    stats.migrated++;
    console.log(`✓ Migrated: ${filename}${isHtmlFile ? ` → ${destFilename}` : ''}`);

  } catch (error) {
    stats.errors.push({
      file: filename,
      error: error.message
    });
    stats.skipped++;
    console.error(`✗ Error migrating ${filename}: ${error.message}`);
  }
}

/**
 * Main migration function
 */
function migrateAllPages() {
  console.log('Starting Jekyll to Astro pages migration...\n');
  console.log(`Reading pages from: ${JEKYLL_PAGES_DIR}`);
  console.log(`Writing pages to: ${ASTRO_PAGES_DIR}\n`);

  // Ensure destination directory exists
  if (!fs.existsSync(ASTRO_PAGES_DIR)) {
    fs.mkdirSync(ASTRO_PAGES_DIR, { recursive: true });
    console.log(`Created directory: ${ASTRO_PAGES_DIR}\n`);
  }

  // Read all markdown and html files from Jekyll pages directory
  let files;
  try {
    files = fs.readdirSync(JEKYLL_PAGES_DIR)
      .filter(file => file.endsWith('.md') || file.endsWith('.html'))
      .sort();
  } catch (error) {
    console.error(`Error reading Jekyll pages directory: ${error.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error('No markdown or HTML files found in Jekyll pages directory.');
    process.exit(1);
  }

  stats.total = files.length;

  // Migrate each page
  console.log(`Found ${files.length} file(s). Starting migration...\n`);
  files.forEach(file => migratePage(file));

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total files processed: ${stats.total}`);
  console.log(`Successfully migrated: ${stats.migrated}`);
  console.log(`Skipped/Errors: ${stats.skipped}`);

  if (stats.htmlFiles.length > 0) {
    console.log(`\nConverted HTML files to Markdown (${stats.htmlFiles.length}):`);
    stats.htmlFiles.forEach(file => {
      const mdFile = file.replace(/\.html$/, '.md');
      console.log(`  - ${file} → ${mdFile}`);
    });
  }

  if (stats.archiveFiles.length > 0) {
    console.log(`\nArchive files (not migrated - ${stats.archiveFiles.length}):`);
    stats.archiveFiles.forEach(item => {
      console.log(`  - ${item.file}`);
      console.log(`    ${item.note}`);
    });
  }

  if (stats.errors.length > 0) {
    console.log(`\nErrors encountered (${stats.errors.length}):`);
    stats.errors.forEach(err => {
      console.log(`  - ${err.file}: ${err.error}`);
    });
  }

  console.log('\nMigration complete!');

  // Exit with appropriate code
  process.exit(stats.errors.length > 0 ? 1 : 0);
}

// Run migration
migrateAllPages();
