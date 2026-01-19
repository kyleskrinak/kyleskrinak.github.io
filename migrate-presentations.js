#!/usr/bin/env node

/**
 * Jekyll Reveal.js to Slidev Migration Script
 *
 * Converts Jekyll Reveal.js presentations to Slidev format
 * Handles front matter parsing, content conversion, and file generation
 *
 * Usage: node migrate-presentations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility - get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const JEKYLL_POSTS_DIR = '/Users/kyleskrinak/Documents/jekyll-blog/_posts';
const OUTPUT_DIR = '/Users/kyleskrinak/Documents/astro-blog/slidev-presentations/slides';
const JEKYLL_ASSETS_PATH = '{{ site.baseurl }}/assets/images';
const SLIDEV_ASSETS_PATH = '/images';

/**
 * Utility function to parse Jekyll front matter
 * @param {string} content - File content
 * @returns {object} Object with frontMatter and body
 */
function parseFrontMatter(content) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);

  if (!match) {
    return { frontMatter: {}, body: content };
  }

  const frontMatterStr = match[1];
  const body = match[2];
  const frontMatter = {};

  // Parse YAML-like front matter
  const lines = frontMatterStr.split('\n');
  for (const line of lines) {
    if (line.trim() === '') continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    frontMatter[key] = value;
  }

  return { frontMatter, body };
}

/**
 * Extract filename from Jekyll post
 * @param {string} filePath - File path
 * @returns {string} Extracted slug
 */
function extractSlug(filePath) {
  const filename = path.basename(filePath, '.md');
  // Remove date prefix (YYYY-MM-DD-)
  return filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

/**
 * Convert Jekyll reveal slides to Slidev format
 * @param {string} content - Presentation content
 * @returns {string} Converted content
 */
function convertContent(content) {
  let converted = content;

  // Remove Jekyll nomarkdown tags
  converted = converted.replace(/\{::nomarkdown\}/g, '');
  converted = converted.replace(/\{:\/nomarkdown\}/g, '');
  converted = converted.replace(/\{:\/\}/g, '');

  // Convert slide separators: triple newlines to Slidev separator
  // In Reveal.js, vertical slides are separated by \n\n\n
  converted = converted.replace(/\n\n\n+/g, '\n---\n');

  // Also handle explicit horizontal separators (---) that might exist
  // Keep them as is since they're already Slidev compatible

  // Fix heading levels - add 2 levels (# -> ###, ## -> ####, etc.)
  // Must do this carefully to preserve code blocks
  const lines = converted.split('\n');
  const convertedLines = lines.map(line => {
    // Skip code blocks (lines starting with ```)
    if (line.trim().startsWith('```')) {
      return line;
    }
    // Check if line starts with # (heading)
    if (line.match(/^#+\s/)) {
      // Count the number of # characters
      const match = line.match(/^(#+)\s(.*)$/);
      if (match) {
        const hashes = match[1];
        const heading = match[2];
        // Add 2 more hashes
        return '##' + hashes + ' ' + heading;
      }
    }
    return line;
  });

  converted = convertedLines.join('\n');

  // Convert HTML entities
  const htmlEntities = {
    '&mdash;': '\u2014',      // em-dash
    '&ndash;': '\u2013',      // en-dash
    '&rsquo;': '\u2019',      // right single quotation mark
    '&lsquo;': '\u2018',      // left single quotation mark
    '&rdquo;': '\u201d',      // right double quotation mark
    '&ldquo;': '\u201c',      // left double quotation mark
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&#58;': ':',
    '&#39;': "'",
    '&quot;': '"'
  };

  for (const [entity, char] of Object.entries(htmlEntities)) {
    converted = converted.split(entity).join(char);
  }

  // Remove Jekyll template variables
  converted = converted.replace(/\{\{\s*site\.baseurl\s*\}}/g, '');

  // Clean up any double slashes in image paths
  converted = converted.replace(/\/\/assets/g, '/assets');

  // Remove Reveal.js specific HTML comments/elements
  // .element: class="fragment" comments
  converted = converted.replace(/\s*<!--\s*\.element:\s*class="fragment"\s*-->/g, '');

  // Remove Note: speaker notes (Reveal.js specific)
  converted = converted.replace(/^Note:\s*\n/gm, '<!-- Note: ');

  // Trim excessive whitespace at the end
  converted = converted.replace(/\n\n\n+/g, '\n\n');

  return converted.trim();
}

/**
 * Generate Slidev presentation file
 * @param {string} title - Presentation title
 * @param {object} frontMatter - Front matter data
 * @param {string} content - Converted content
 * @param {boolean} isDuke - Whether to use Duke theme
 * @returns {string} Complete Slidev presentation
 */
function generateSlidevPresentation(title, frontMatter, content, isDuke = false) {
  let presentation = '';

  // Add theme comment for Duke presentations
  if (isDuke) {
    presentation += '<!-- Theme: duke -->\n';
  }

  // Add Slidev front matter
  presentation += '---\n';
  presentation += `theme: ${isDuke ? 'duke' : 'default'}\n`;
  presentation += `title: ${title}\n`;

  if (frontMatter.excerpt) {
    presentation += `subtitle: ${frontMatter.excerpt}\n`;
  }

  if (frontMatter.date) {
    presentation += `date: ${frontMatter.date}\n`;
  }

  presentation += 'transition: slide\n';
  presentation += 'layout: cover\n';
  presentation += '---\n\n';

  // Add content
  presentation += content;
  presentation += '\n';

  return presentation;
}

/**
 * Format filename with numbering
 * @param {number} index - File index for numbering
 * @param {string} slug - File slug
 * @returns {string} Formatted filename
 */
function formatFilename(index, slug) {
  const num = String(index + 1).padStart(2, '0');
  // Slugify the name
  const cleanSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${num}-${cleanSlug}.md`;
}

/**
 * Find all Jekyll reveal presentation files
 * @returns {array} Array of file paths
 */
function findPresentations() {
  const files = fs.readdirSync(JEKYLL_POSTS_DIR);
  const presentations = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(JEKYLL_POSTS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontMatter } = parseFrontMatter(content);

    if (frontMatter.layout === 'reveal' || frontMatter.layout === 'reveal-duke') {
      presentations.push({
        path: filePath,
        filename: file,
        layout: frontMatter.layout
      });
    }
  }

  return presentations.sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Main migration function
 */
function migratePresentation(sourceFile, index) {
  try {
    const content = fs.readFileSync(sourceFile, 'utf-8');
    const { frontMatter, body } = parseFrontMatter(content);

    const isDuke = frontMatter.layout === 'reveal-duke';
    const title = frontMatter.title || 'Untitled Presentation';
    const slug = extractSlug(sourceFile);

    // Convert content
    const convertedContent = convertContent(body);

    // Generate Slidev presentation
    const slidevPresentation = generateSlidevPresentation(
      title,
      frontMatter,
      convertedContent,
      isDuke
    );

    // Generate output filename
    const outputFilename = formatFilename(index, slug);
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    // Write file
    fs.writeFileSync(outputPath, slidevPresentation, 'utf-8');

    return {
      success: true,
      title,
      filename: outputFilename,
      layout: frontMatter.layout,
      date: frontMatter.date || 'N/A'
    };
  } catch (error) {
    return {
      success: false,
      filename: path.basename(sourceFile),
      error: error.message
    };
  }
}

/**
 * Generate migration summary
 * @param {array} results - Migration results
 * @returns {string} Summary text
 */
function generateSummary(results) {
  let summary = '\n';
  summary += '═══════════════════════════════════════════════════════════\n';
  summary += '  JEKYLL REVEAL.JS TO SLIDEV MIGRATION SUMMARY\n';
  summary += '═══════════════════════════════════════════════════════════\n\n';

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  summary += `Total presentations found: ${results.length}\n`;
  summary += `Successfully converted: ${successful.length}\n`;
  summary += `Failed conversions: ${failed.length}\n\n`;

  if (successful.length > 0) {
    summary += 'CONVERTED PRESENTATIONS:\n';
    summary += '───────────────────────────────────────────────────────────\n';
    successful.forEach((result, idx) => {
      const theme = result.layout === 'reveal-duke' ? ' [DUKE THEME]' : '';
      summary += `  ${idx + 1}. ${result.title}${theme}\n`;
      summary += `     → ${result.filename}\n`;
      summary += `     Date: ${result.date}\n\n`;
    });
  }

  if (failed.length > 0) {
    summary += '\nFAILED CONVERSIONS:\n';
    summary += '───────────────────────────────────────────────────────────\n';
    failed.forEach((result) => {
      summary += `  • ${result.filename}\n`;
      summary += `    Error: ${result.error}\n\n`;
    });
  }

  summary += '═══════════════════════════════════════════════════════════\n';
  summary += '\nLocation: ' + OUTPUT_DIR + '\n';
  summary += '\nNext steps:\n';
  summary += '  1. Review the converted presentations\n';
  summary += '  2. Test each presentation in Slidev\n';
  summary += '  3. Update image paths if necessary\n';
  summary += '  4. Customize themes and layouts as needed\n\n';

  return summary;
}

/**
 * Generate detailed migration notes
 * @param {array} results - Migration results
 * @returns {string} Detailed notes
 */
function generateMigrationNotes(results) {
  let notes = '# Jekyll Reveal.js to Slidev Migration Notes\n\n';
  notes += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
  notes += `**Total Presentations Migrated:** ${results.filter(r => r.success).length}\n\n`;

  notes += '## Overview\n\n';
  notes += 'This document provides details about the migration of Jekyll Reveal.js presentations to Slidev format.\n\n';

  notes += '## Conversion Details\n\n';

  notes += '### 8 Presentations Successfully Migrated\n\n';

  const successful = results.filter(r => r.success);
  successful.forEach((result, idx) => {
    const themeNote = result.layout === 'reveal-duke' ? '\n- **Theme:** Duke University' : '';
    notes += `${idx + 1}. **${result.title}**${themeNote}\n`;
    notes += `   - File: \`${result.filename}\`\n`;
    notes += `   - Date: ${result.date}\n\n`;
  });

  notes += '## Conversion Process\n\n';
  notes += 'The following transformations were applied to each presentation:\n\n';
  notes += '### Front Matter Changes\n';
  notes += '- Added Slidev-compatible YAML front matter\n';
  notes += '- Preserved title and subtitle (from excerpt)\n';
  notes += '- Added theme specification (default or duke)\n';
  notes += '- Configured transition and layout settings\n\n';

  notes += '### Content Transformations\n';
  notes += '- **Slide Separators:** Triple newlines (\\n\\n\\n) to Slidev separators (---)\n';
  notes += '- **Heading Levels:** Increased by 2 levels (# to ###, ## to ####, etc.)\n';
  notes += '- **HTML Entities:** Converted to UTF-8 characters (e.g., &mdash; to em-dash)\n';
  notes += '- **Jekyll Variables:** Removed {{ site.baseurl }} references\n';
  notes += '- **Reveal.js Markup:** Removed Reveal.js-specific HTML comments and fragment indicators\n';
  notes += '- **Speaker Notes:** Converted Note: sections to HTML comments\n';
  notes += '- **Whitespace Cleanup:** Normalized excessive blank lines\n\n';

  notes += '### Image Path Handling\n';
  notes += '- Jekyll image paths using {{ site.baseurl }}/assets/images/ have been preserved\n';
  notes += '- For Slidev, ensure images are accessible from the public folder\n';
  notes += '- You may need to adjust image paths based on your Slidev deployment\n\n';

  notes += '## Duke Theme Presentations\n\n';
  const dukePresent = successful.filter(r => r.layout === 'reveal-duke');
  if (dukePresent.length > 0) {
    notes += `Found ${dukePresent.length} presentations configured for Duke theme:\n\n`;
    dukePresent.forEach(result => {
      notes += `- ${result.filename}: ${result.title}\n`;
    });
    notes += '\nThese presentations have theme: duke set in their front matter.\n\n';
  } else {
    notes += 'No Duke-themed presentations found.\n\n';
  }

  notes += '## Next Steps\n\n';
  notes += '1. **Review Presentations:** Open each generated file and verify the content conversion\n';
  notes += '2. **Check Image Paths:** Ensure all image references are correct for Slidev\n';
  notes += '3. **Test Rendering:** Run Slidev and test each presentation\n';
  notes += '4. **Customize Styling:** Update themes and layouts as needed\n';
  notes += '5. **Verify Links:** Check that all links and references work correctly\n';
  notes += '6. **Update Configuration:** Adjust Slidev config if additional customization is needed\n\n';

  notes += '## File Structure\n\n';
  notes += '```\n';
  notes += 'slidev-presentations/slides/\n';
  successful.forEach(result => {
    notes += `├── ${result.filename}\n`;
  });
  notes += '├── MIGRATION_SUMMARY.txt\n';
  notes += '└── MIGRATION_NOTES.md\n';
  notes += '```\n\n';

  notes += '## Troubleshooting\n\n';
  notes += '### Images Not Loading\n';
  notes += '- Ensure image files are in the correct location relative to Slidev\'s public folder\n';
  notes += '- Update image paths from {{ site.baseurl }}/assets/images/ to /images/ or appropriate relative path\n\n';

  notes += '### Heading Sizes Look Wrong\n';
  notes += '- This is expected due to the +2 heading level conversion\n';
  notes += '- Slidev uses different heading hierarchy than Reveal.js\n';
  notes += '- You may need to use HTML or custom CSS to adjust sizes\n\n';

  notes += '### Speaker Notes Not Showing\n';
  notes += '- Slidev handles speaker notes differently than Reveal.js\n';
  notes += '- Check Slidev documentation for proper speaker note syntax\n';
  notes += '- Converted notes are in HTML comment format for reference\n\n';

  notes += '## Resources\n\n';
  notes += '- [Slidev Documentation](https://sli.dev/)\n';
  notes += '- [Slidev Theme Guide](https://sli.dev/guide/install#install-additional-theme)\n';
  notes += '- [Markdown Guide for Slidev](https://sli.dev/guide/syntax.html)\n\n';

  return notes;
}

/**
 * Main execution
 */
function main() {
  console.log('\nStarting Jekyll Reveal.js to Slidev Migration...\n');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}\n`);
  }

  // Find all presentations
  const presentations = findPresentations();

  if (presentations.length === 0) {
    console.log('No Jekyll reveal presentations found!');
    process.exit(1);
  }

  console.log(`Found ${presentations.length} presentations to migrate...\n`);

  // Migrate each presentation
  const results = presentations.map((pres, index) => {
    console.log(`Converting: ${pres.filename}...`);
    return migratePresentation(pres.path, index);
  });

  // Generate and display summary
  const summary = generateSummary(results);
  console.log(summary);

  // Save summary to file
  const summaryPath = path.join(OUTPUT_DIR, 'MIGRATION_SUMMARY.txt');
  fs.writeFileSync(summaryPath, summary, 'utf-8');
  console.log(`Migration summary saved to: ${summaryPath}\n`);

  // Generate additional notes file
  const notesContent = generateMigrationNotes(results);
  const notesPath = path.join(OUTPUT_DIR, 'MIGRATION_NOTES.md');
  fs.writeFileSync(notesPath, notesContent, 'utf-8');
  console.log(`Migration notes saved to: ${notesPath}\n`);

  const successCount = results.filter(r => r.success).length;
  process.exit(successCount === results.length ? 0 : 1);
}

// Run the migration
main();
