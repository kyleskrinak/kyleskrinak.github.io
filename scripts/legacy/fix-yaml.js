#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.join(__dirname, 'src', 'content', 'blog');

/**
 * Extract front matter from markdown file
 */
function extractFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return null;
  }
  return {
    frontmatter: match[1],
    body: match[2]
  };
}

/**
 * Fix YAML indentation and formatting
 */
function fixYaml(yamlString) {
  try {
    // Parse the YAML
    const data = yaml.load(yamlString);

    // Dump it back with proper formatting
    // Using safe dump with options to ensure clean output
    const fixed = yaml.dump(data, {
      indent: 2,
      lineWidth: -1,  // Disable line wrapping
      noRefs: true,
      skipInvalid: false,
      flowLevel: -1,  // Use block style for all collections
      quotingType: '"',  // Use double quotes for strings that need quoting
    });

    return fixed.trim();
  } catch (error) {
    console.error(`Failed to parse YAML: ${error.message}`);
    return null;
  }
}

/**
 * Process a single markdown file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const extracted = extractFrontMatter(content);

    if (!extracted) {
      console.log(`  ✗ No front matter found`);
      return { fixed: false, reason: 'No front matter' };
    }

    // Try to fix the YAML
    const fixedYaml = fixYaml(extracted.frontmatter);

    if (!fixedYaml) {
      console.log(`  ✗ Could not fix YAML`);
      return { fixed: false, reason: 'Could not parse YAML' };
    }

    // Check if there were actual changes
    if (fixedYaml === extracted.frontmatter.trim()) {
      console.log(`  ✓ Already valid`);
      return { fixed: false, reason: 'Already valid' };
    }

    // Reconstruct the file
    const newContent = `---\n${fixedYaml}\n---\n${extracted.body}`;

    // Write back
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`  ✓ Fixed`);
    return { fixed: true, reason: 'YAML reformatted' };

  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    return { fixed: false, reason: error.message };
  }
}

/**
 * Main function
 */
function main() {
  console.log(`Fixing YAML front matter in ${blogDir}\n`);

  // Get all .md files
  const files = fs.readdirSync(blogDir)
    .filter(f => f.endsWith('.md'))
    .sort();

  console.log(`Found ${files.length} markdown files\n`);

  let fixedCount = 0;
  const results = [];

  files.forEach(file => {
    const filePath = path.join(blogDir, file);
    process.stdout.write(`Processing: ${file}`);

    const result = processFile(filePath);
    results.push({ file, ...result });

    if (result.fixed) {
      fixedCount++;
    }
  });

  console.log(`\n================================`);
  console.log(`Summary: ${fixedCount}/${files.length} files fixed`);
  console.log(`================================\n`);

  // Show detailed results
  const fixedFiles = results.filter(r => r.fixed);
  if (fixedFiles.length > 0) {
    console.log('Fixed files:');
    fixedFiles.forEach(r => {
      console.log(`  - ${r.file}`);
    });
  }
}

// Run
main();
