#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Configuration
const JEKYLL_POSTS_DIR = '/Users/kyleskrinak/Documents/jekyll-blog/_posts/';
const ASTRO_POSTS_DIR = '/Users/kyleskrinak/Documents/astro-blog/src/content/posts/';

// Statistics
const stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  errors: [],
  skippedPresentations: []
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
 * Convert Jekyll date format to ISO 8601
 */
function convertDate(dateString) {
  // Jekyll dates are typically YYYY-MM-DD format
  if (!dateString) return null;

  // Handle both string and Date objects
  const dateObj = typeof dateString === 'string' ? new Date(dateString) : dateString;

  if (isNaN(dateObj.getTime())) {
    return null;
  }

  return dateObj.toISOString();
}

/**
 * Normalize categories - convert string to array and trim whitespace
 */
function normalizeCategories(category) {
  if (!category) return [];

  if (Array.isArray(category)) {
    return category.map(c => c.trim()).filter(c => c.length > 0);
  }

  if (typeof category === 'string') {
    return [category.trim()].filter(c => c.length > 0);
  }

  return [];
}

/**
 * Normalize tags - ensure array format
 */
function normalizeTags(tags) {
  if (!tags) return [];

  if (Array.isArray(tags)) {
    return tags.map(t => t.trim()).filter(t => t.length > 0);
  }

  if (typeof tags === 'string') {
    return [tags.trim()].filter(t => t.length > 0);
  }

  return [];
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
 * Convert Jekyll front matter to Astro format
 */
function convertFrontMatter(jekyllData, filename, dateFromFilename) {
  const astroData = {};

  // Required fields
  if (jekyllData.title) {
    astroData.title = fixHtmlEntities(jekyllData.title);
  }

  // Date handling - prefer filename date, fall back to front matter
  const dateString = dateFromFilename || jekyllData.date;
  if (dateString) {
    const isoDate = convertDate(dateString);
    if (isoDate) {
      astroData.pubDate = isoDate;
    }
  }

  // Handle categories
  if (jekyllData.category) {
    astroData.categories = normalizeCategories(jekyllData.category);
  } else {
    astroData.categories = [];
  }

  // Handle tags
  if (jekyllData.tags) {
    astroData.tags = normalizeTags(jekyllData.tags);
  }

  // Create description from excerpt
  if (jekyllData.excerpt) {
    astroData.description = fixHtmlEntities(jekyllData.excerpt);
  }

  // Optional fields that might exist
  if (jekyllData.author) {
    astroData.author = jekyllData.author;
  }

  if (jekyllData.comments !== undefined) {
    astroData.comments = jekyllData.comments;
  }

  // Store header image info if present
  if (jekyllData.header && jekyllData.header.overlay_image) {
    astroData.image = jekyllData.header.overlay_image;
  }

  return astroData;
}

/**
 * Extract date from filename (YYYY-MM-DD format at start)
 */
function extractDateFromFilename(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Read and migrate a single Jekyll post
 */
function migratePost(filename) {
  const filePath = path.join(JEKYLL_POSTS_DIR, filename);

  try {
    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Parse front matter
    const { data: jekyllData, content: jekyllContent } = matter(fileContent);

    // Skip presentation posts (layout: reveal)
    if (jekyllData.layout === 'reveal') {
      stats.skippedPresentations.push(filename);
      stats.skipped++;
      return;
    }

    // Extract date from filename
    const dateFromFilename = extractDateFromFilename(filename);

    // Convert front matter to Astro format
    const astroData = convertFrontMatter(jekyllData, filename, dateFromFilename);

    // Convert content (image paths, etc.)
    let astroContent = convertImagePaths(jekyllContent);

    // Build the new markdown file
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

    // Write to Astro posts directory
    const destPath = path.join(ASTRO_POSTS_DIR, filename);
    fs.writeFileSync(destPath, output, 'utf-8');

    stats.migrated++;
    console.log(`✓ Migrated: ${filename}`);

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
function migrateAllPosts() {
  console.log('Starting Jekyll to Astro migration...\n');
  console.log(`Reading posts from: ${JEKYLL_POSTS_DIR}`);
  console.log(`Writing posts to: ${ASTRO_POSTS_DIR}\n`);

  // Ensure destination directory exists
  if (!fs.existsSync(ASTRO_POSTS_DIR)) {
    fs.mkdirSync(ASTRO_POSTS_DIR, { recursive: true });
    console.log(`Created directory: ${ASTRO_POSTS_DIR}\n`);
  }

  // Read all markdown files from Jekyll posts directory
  let files;
  try {
    files = fs.readdirSync(JEKYLL_POSTS_DIR)
      .filter(file => file.endsWith('.md'))
      .sort();
  } catch (error) {
    console.error(`Error reading Jekyll posts directory: ${error.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error('No markdown files found in Jekyll posts directory.');
    process.exit(1);
  }

  stats.total = files.length;

  // Migrate each post
  console.log(`Found ${files.length} markdown file(s). Starting migration...\n`);
  files.forEach(file => migratePost(file));

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total files processed: ${stats.total}`);
  console.log(`Successfully migrated: ${stats.migrated}`);
  console.log(`Skipped/Errors: ${stats.skipped}`);

  if (stats.skippedPresentations.length > 0) {
    console.log(`\nSkipped ${stats.skippedPresentations.length} presentation post(s):`);
    stats.skippedPresentations.forEach(file => {
      console.log(`  - ${file}`);
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
migrateAllPosts();
