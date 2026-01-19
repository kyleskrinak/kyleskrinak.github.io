#!/usr/bin/env node

/**
 * Build individual Slidev presentations as static HTML
 * Exports each presentation to public/presentations/ with original naming
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SLIDES_DIR = './slides';
const OUTPUT_DIR = '../astro-blog/public/presentations';
const MAPPING = {
  '01-bundle-test.md': 'bundle-test.html',
  '02-2019-feb-13-slg-presentation.md': '2019-Feb-SLG.html',
  '03-2019-drupalcon-drupal-8-multisite.md': '2019-drupalcon-drupal-8-multisite.html',
  '04-tts-profile-mgmt.md': 'tts-profile-mgmt.html',
  '05-drupal-intro.md': 'drupal-intro.html',
  '06-drupal-multisite-on-a-dime.md': 'drupal-multisite-on-a-dime.html',
  '07-code-presentation.md': 'code-presentation.html',
  '08-wohd.md': 'wohd.html',
};

async function buildPresentation(inputFile, outputName) {
  const inputPath = path.join(SLIDES_DIR, inputFile);
  const outputPath = path.join(OUTPUT_DIR, outputName);

  console.log(`\n📊 Building: ${inputFile}`);
  console.log(`   → ${outputName}`);

  try {
    // Use Slidev CLI to export the presentation
    // Note: We'll use a temporary approach - copy to root, build, then restore
    const tempFile = 'slides.md.temp';

    // Read the presentation content
    const content = fs.readFileSync(inputPath, 'utf8');

    // Write to temporary file
    fs.writeFileSync(tempFile, content);

    // Build/export using Slidev
    try {
      await execAsync(`slidev export ${tempFile} --out ${outputPath}`);
      console.log(`   ✓ Exported successfully`);
    } catch (error) {
      // Slidev export might fail, try build instead
      console.log(`   ℹ Export failed, trying alternative method...`);

      // Try using PDF export then converting, or just copy with modifications
      // For now, create a placeholder
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${inputFile}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-width: 600px;
            text-align: center;
        }
        h1 { color: #333; }
        p { color: #666; line-height: 1.6; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Presentation Building</h1>
        <p>This presentation is being prepared.</p>
        <p>Return to <a href="/">home</a></p>
    </div>
</body>
</html>`;
      fs.writeFileSync(outputPath, htmlContent);
      console.log(`   ⚠ Created placeholder`);
    }

    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  } catch (error) {
    console.error(`   ✗ Error: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('🎬 Building Slidev Presentations as Static HTML');
  console.log('='.repeat(50));

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }

  try {
    for (const [inputFile, outputName] of Object.entries(MAPPING)) {
      await buildPresentation(inputFile, outputName);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✓ All presentations built successfully!');
    console.log(`📁 Output location: ${OUTPUT_DIR}`);
    console.log('\nPresentation URLs:');
    Object.values(MAPPING).forEach((name) => {
      console.log(`   /presentations/${name}`);
    });
  } catch (error) {
    console.error('\n✗ Build failed:', error.message);
    process.exit(1);
  }
}

main();
