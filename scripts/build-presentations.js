#!/usr/bin/env node

/**
 * Build Slidev presentations as standalone HTML
 * Converts markdown presentations to HTML with Slidev styling
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MarkdownIt from 'markdown-it';
import markdownItTableOfContents from 'markdown-it-table-of-contents';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize markdown-it with table support enabled
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false
});

// Enable table parsing
md.enable('table');

const PRESENTATIONS = [
  { input: 'slidev-presentations/slides/01-bundle-test.md', output: 'bundle-test.html', title: 'Bundle Test' },
  { input: 'slidev-presentations/slides/02-2019-feb-13-slg-presentation.md', output: '2019-Feb-SLG.html', title: '2019-Feb-13 SLG Presentation' },
  { input: 'slidev-presentations/slides/03-2019-drupalcon-drupal-8-multisite.md', output: '2019-drupalcon-drupal-8-multisite.html', title: '2019 DrupalCon Drupal 8 Multisite' },
  { input: 'slidev-presentations/slides/04-tts-profile-mgmt.md', output: 'tts-profile-mgmt.html', title: 'How to Manage Departmental Faculty and Staff Data' },
  { input: 'slidev-presentations/slides/05-drupal-intro.md', output: 'drupal-intro.html', title: 'Introduction to Drupal' },
  { input: 'slidev-presentations/slides/06-drupal-multisite-on-a-dime.md', output: 'drupal-multisite-on-a-dime.html', title: 'Drupal Multisite on a Dime' },
  { input: 'slidev-presentations/slides/07-code-presentation.md', output: 'code-presentation.html', title: 'DrupalCon 2022 Code+ Presentation' },
  { input: 'slidev-presentations/slides/08-wohd.md', output: 'wohd.html', title: 'What I did at DrupalCon 2022' },
];

const PUBLIC_DIR = 'public/presentations';

function parseMarkdownPresentation(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Extract Slidev front matter: skip past all --- delimiters at the top
  // Slidev format: --- (start) ... --- (end) ... --- (first slide boundary)
  let contentStart = 0;
  let dashCount = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '---') {
      dashCount++;
      // After second ---, we're past front matter
      if (dashCount >= 2) {
        contentStart = i + 1;
        break;
      }
    }
  }

  // Parse slides (separated by --- in Slidev presentations)
  const slides = [];
  let currentSlide = [];

  // Skip to first non-empty line after front matter
  while (contentStart < lines.length && lines[contentStart].trim() === '') {
    contentStart++;
  }

  for (let i = contentStart; i < lines.length; i++) {
    // Slidev uses --- as slide separator
    if (lines[i] === '---') {
      if (currentSlide.length > 0) {
        slides.push(currentSlide.join('\n').trim());
        currentSlide = [];
      }
    } else if (lines[i] === '{:/}') {
      // Skip closing Jekyll tag if present
      continue;
    } else {
      currentSlide.push(lines[i]);
    }
  }

  if (currentSlide.length > 0) {
    slides.push(currentSlide.join('\n').trim());
  }

  return { slides };
}

function markdownToHtml(markdown) {
  // Use markdown-it for comprehensive markdown support
  // This handles: headings, lists, code blocks, tables, links, images, bold, italic, etc.
  return md.render(markdown);
}

function generateHtml(title, slides) {
  const slideHtml = slides
    .map((slide, idx) => {
      const html = markdownToHtml(slide);
      const isTitle = idx === 0 ? 'slide-title' : '';
      return `
        <section class="slide ${isTitle}">
          <div class="slide-content">
            ${html}
          </div>
          <div class="slide-number">${idx + 1} / ${slides.length}</div>
        </section>
      `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a1a;
            color: #fff;
            overflow: hidden;
        }

        .presentation-container {
            position: relative;
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .slide {
            position: absolute;
            width: 100%;
            height: 100%;
            padding: 60px;
            display: none;
            flex-direction: column;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            animation: fadeIn 0.5s;
        }

        .slide.active {
            display: flex;
        }

        .slide.slide-title {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .slide-content {
            font-size: 1.5rem;
            line-height: 1.8;
        }

        .slide h1 {
            font-size: 3.5rem;
            margin-bottom: 1rem;
        }

        .slide h2 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            margin-top: 1.5rem;
        }

        .slide h3 {
            font-size: 2rem;
            margin-bottom: 0.8rem;
            margin-top: 1rem;
        }

        .slide ul {
            list-style-position: inside;
            margin: 1rem 0;
        }

        .slide li {
            margin: 0.5rem 0;
            margin-left: 2rem;
        }

        .slide a {
            color: #fff;
            text-decoration: underline;
        }

        .slide p {
            margin: 1rem 0;
        }

        .slide code {
            background: rgba(0, 0, 0, 0.2);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
        }

        .slide pre {
            background: rgba(0, 0, 0, 0.3);
            padding: 1rem;
            border-radius: 6px;
            overflow-x: auto;
            margin: 1rem 0;
        }

        .slide pre code {
            background: none;
            padding: 0;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.85em;
            line-height: 1.5;
        }

        .slide hr {
            border: none;
            border-top: 2px solid rgba(255, 255, 255, 0.3);
            margin: 1.5rem 0;
        }

        .slide table {
            border-collapse: collapse;
            width: 100%;
            margin: 1.5rem 0;
            font-size: 0.9rem;
        }

        .slide table thead {
            background: rgba(0, 0, 0, 0.2);
        }

        .slide table th,
        .slide table td {
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 0.75rem;
            text-align: left;
        }

        .slide table tbody tr:nth-child(even) {
            background: rgba(0, 0, 0, 0.1);
        }

        .slide table tbody tr:hover {
            background: rgba(0, 0, 0, 0.15);
        }

        .slide-number {
            position: absolute;
            bottom: 20px;
            right: 40px;
            font-size: 1rem;
            opacity: 0.7;
        }

        .controls {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            z-index: 1000;
            background: rgba(0, 0, 0, 0.5);
            padding: 15px 25px;
            border-radius: 50px;
        }

        button {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.3s;
        }

        button:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        button:active {
            transform: scale(0.95);
        }

        .home-link {
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.5);
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 0.9rem;
            z-index: 100;
        }

        .home-link:hover {
            background: rgba(0, 0, 0, 0.7);
        }

        .progress-bar {
            position: fixed;
            top: 0;
            left: 0;
            height: 4px;
            background: rgba(255, 255, 255, 0.5);
            z-index: 10;
            transition: width 0.3s;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @media (max-width: 768px) {
            .slide {
                padding: 40px;
            }
            .slide h1 {
                font-size: 2rem;
            }
            .slide h2 {
                font-size: 1.5rem;
            }
            .slide-content {
                font-size: 1rem;
            }
            .controls {
                padding: 10px 15px;
            }
            button {
                padding: 6px 12px;
                font-size: 0.9rem;
            }
        }
    </style>
</head>
<body>
    <a href="/" class="home-link">← Home</a>
    <div class="progress-bar" id="progressBar"></div>

    <div class="presentation-container" id="container" data-pagefind-body>
        ${slideHtml}
    </div>

    <div class="controls">
        <button onclick="prevSlide()">← Previous</button>
        <button onclick="nextSlide()">Next →</button>
        <button onclick="toggleFullscreen()">Fullscreen</button>
    </div>

    <script>
        let currentSlide = 0;
        const slides = document.querySelectorAll('.slide');
        const totalSlides = slides.length;

        function showSlide(n) {
            slides[currentSlide].classList.remove('active');
            currentSlide = (n + totalSlides) % totalSlides;
            slides[currentSlide].classList.add('active');

            // Update progress bar
            const progress = ((currentSlide + 1) / totalSlides) * 100;
            document.getElementById('progressBar').style.width = progress + '%';
        }

        function nextSlide() {
            showSlide(currentSlide + 1);
        }

        function prevSlide() {
            showSlide(currentSlide - 1);
        }

        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    alert('Could not enter fullscreen: ' + err.message);
                });
            } else {
                document.exitFullscreen();
            }
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                nextSlide();
            } else if (e.key === 'ArrowLeft') {
                prevSlide();
            }
        });

        // Initialize
        showSlide(0);
    </script>
</body>
</html>`;
}

async function buildPresentation(inputPath, outputName, title) {
  const outputPath = path.join(PUBLIC_DIR, outputName);

  console.log(`\n📊 Building: ${path.basename(inputPath)}`);
  console.log(`   → ${outputName}`);

  try {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const { slides } = parseMarkdownPresentation(inputPath);
    if (slides.length === 0) {
      throw new Error('No slides found');
    }

    const html = generateHtml(title, slides);
    fs.writeFileSync(outputPath, html);

    console.log(`   ✓ Generated ${slides.length} slides`);
  } catch (error) {
    console.error(`   ✗ Error: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('\n🎬 Building Slidev Presentations as Static HTML');
  console.log('='.repeat(60));

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    console.log(`✓ Created output directory: ${PUBLIC_DIR}`);
  }

  let successCount = 0;
  for (const { input, output, title } of PRESENTATIONS) {
    try {
      await buildPresentation(input, output, title);
      successCount++;
    } catch (error) {
      console.error(`Failed to build ${output}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✓ Build complete: ${successCount}/${PRESENTATIONS.length} presentations created`);
  console.log(`📁 Output: ${PUBLIC_DIR}`);
  console.log('\n📍 Presentation URLs:');
  PRESENTATIONS.forEach(({ output }) => {
    console.log(`   /presentations/${output}`);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
