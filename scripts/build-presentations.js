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
// Security: html disabled to prevent XSS via arbitrary HTML/script tags in slides
const md = new MarkdownIt({
  html: false,  // Disable raw HTML to prevent XSS
  linkify: true,
  typographer: true,
  breaks: false
});

// Enable table parsing
md.enable('table');

const PUBLIC_DIR = 'public/presentations';
const SLIDES_DIR = 'slidev-presentations/slides';

/**
 * Extract title from frontmatter
 * Looks for "title: ..." in YAML frontmatter
 */
function extractTitleFromFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Look for title in frontmatter (between first and second ---)
  let inFrontmatter = false;
  for (const line of lines) {
    if (line === '---') {
      if (inFrontmatter) break; // End of frontmatter
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter && line.startsWith('title:')) {
      // Extract title, removing quotes if present
      return line.substring(6).trim().replace(/^["']|["']$/g, '');
    }
  }

  // Fallback: use filename without extension
  return path.basename(filePath, '.md');
}

/**
 * Auto-discover presentations from slides directory
 * Excludes template files (00-template.md)
 */
function discoverPresentations() {
  if (!fs.existsSync(SLIDES_DIR)) {
    console.error(`❌ Slides directory not found: ${SLIDES_DIR}`);
    return [];
  }

  const files = fs.readdirSync(SLIDES_DIR)
    .filter(file => file.endsWith('.md') && !file.startsWith('00-template'))
    .sort();

  return files.map(file => {
    const inputPath = path.join(SLIDES_DIR, file);
    const outputName = file.replace('.md', '.html');
    const title = extractTitleFromFrontmatter(inputPath);

    return {
      input: inputPath,
      output: outputName,
      title: title
    };
  });
}

// Auto-discover presentations from slides directory
const PRESENTATIONS = discoverPresentations();

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
  const notes = [];
  let currentSlide = [];

  // Skip to first non-empty line after front matter
  while (contentStart < lines.length && lines[contentStart].trim() === '') {
    contentStart++;
  }

  for (let i = contentStart; i < lines.length; i++) {
    // Slidev uses --- as slide separator
    if (lines[i] === '---') {
      if (currentSlide.length > 0) {
        const parsed = extractNotesFromSlide(currentSlide.join('\n').trim());
        slides.push(parsed.content);
        notes.push(parsed.notes);
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
    const parsed = extractNotesFromSlide(currentSlide.join('\n').trim());
    slides.push(parsed.content);
    notes.push(parsed.notes);
  }

  return { slides, notes };
}

function extractNotesFromSlide(slideContent) {
  // Extract HTML comments as speaker notes
  const commentRegex = /<!--([\s\S]*?)-->/g;
  const notesArray = [];
  let content = slideContent;

  let match;
  while ((match = commentRegex.exec(slideContent)) !== null) {
    notesArray.push(match[1].trim());
  }

  // Remove comments from content
  content = content.replace(commentRegex, '').trim();

  return {
    content,
    notes: notesArray.join('\n\n')
  };
}

function markdownToHtml(markdown) {
  // Use markdown-it for comprehensive markdown support
  // This handles: headings, lists, code blocks, tables, links, images, bold, italic, etc.
  return md.render(markdown);
}

function createChannelName(title) {
  // Create a normalized, slug-style channel name suffix from the title
  const slug = title
    .toString()
    .normalize('NFKD')
    // Remove all characters except word chars, spaces, and dashes
    .replace(/[^\w\s-]/g, '')
    .trim()
    // Replace whitespace runs with single dashes
    .replace(/\s+/g, '-')
    // Collapse multiple dashes
    .replace(/-+/g, '-')
    .toLowerCase();

  // Fallback to a default suffix if the slug becomes empty
  const safeSlug = slug || 'default';
  return 'presentation-sync-' + safeSlug;
}

function generateHtml(title, slides, notes) {
  // Compute channel name once for use in both main and presenter windows
  const channelName = createChannelName(title);

  const slideHtml = slides
    .map((slide, idx) => {
      const html = markdownToHtml(slide);
      const isTitle = idx === 0 ? 'slide-title' : '';
      const slideNotes = notes[idx] || '';
      return `
        <section class="slide ${isTitle}" data-notes="${encodeURIComponent(slideNotes)}">
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

        .notes-panel {
            position: fixed;
            bottom: 90px;
            left: 50%;
            transform: translateX(-50%);
            width: 90%;
            max-width: 800px;
            max-height: 40vh;
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 12px;
            padding: 20px;
            overflow-y: auto;
            display: none;
            z-index: 999;
        }

        .notes-panel.active {
            display: block;
        }

        .notes-panel h3 {
            margin: 0 0 10px 0;
            font-size: 1rem;
            color: rgba(255, 255, 255, 0.7);
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            padding-bottom: 8px;
        }

        .notes-panel p {
            margin: 8px 0;
            font-size: 0.9rem;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.9);
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
    <a href="../" class="home-link">← Home</a>
    <div class="progress-bar" id="progressBar"></div>

    <div class="presentation-container" id="container" data-pagefind-body>
        ${slideHtml}
    </div>

    <div class="notes-panel" id="notesPanel">
        <h3>Speaker Notes</h3>
        <div id="notesContent"></div>
    </div>

    <div class="controls">
        <button onclick="prevSlide()">← Previous</button>
        <button onclick="nextSlide()">Next →</button>
        <button onclick="toggleNotes()">Notes (N)</button>
        <button onclick="openPresenter()">Presenter (P)</button>
        <button onclick="toggleFullscreen()">Fullscreen</button>
    </div>

    <script>
        let currentSlide = 0;
        let notesVisible = false;
        const slides = document.querySelectorAll('.slide');
        const totalSlides = slides.length;
        const notesPanel = document.getElementById('notesPanel');
        const notesContent = document.getElementById('notesContent');
        let presenterWin = null;
        let syncChannel = null;

        // Initialize BroadcastChannel for sync (scoped to this presentation)
        const channelName = ${JSON.stringify(channelName)};
        try {
            syncChannel = new BroadcastChannel(channelName);
            syncChannel.onmessage = (event) => {
                if (event.data.type === 'slideChange') {
                    showSlide(event.data.index, false);
                }
            };
        } catch (e) {
            console.warn('BroadcastChannel not supported');
        }

        function showSlide(n, broadcast = true) {
            slides[currentSlide].classList.remove('active');
            currentSlide = (n + totalSlides) % totalSlides;
            slides[currentSlide].classList.add('active');

            // Update progress bar
            const progress = ((currentSlide + 1) / totalSlides) * 100;
            document.getElementById('progressBar').style.width = progress + '%';

            // Update notes
            updateNotes();

            // Broadcast to other windows
            if (broadcast && syncChannel) {
                syncChannel.postMessage({ type: 'slideChange', index: currentSlide });
            }
        }

        function updateNotes() {
            const notes = slides[currentSlide].getAttribute('data-notes');

            // Clear existing notes content
            while (notesContent.firstChild) {
                notesContent.removeChild(notesContent.firstChild);
            }

            if (notes) {
                let decodedNotes;
                try {
                    decodedNotes = decodeURIComponent(notes);
                } catch (e) {
                    // Fallback to raw notes string if decoding fails (malformed percent-encoding)
                    console.warn('Failed to decode notes:', e);
                    decodedNotes = notes;
                }
                const paragraphs = decodedNotes.split('\\n\\n');

                paragraphs.forEach((paragraphText) => {
                    const p = document.createElement('p');
                    const lines = paragraphText.split('\\n');

                    lines.forEach((line, index) => {
                        if (index > 0) {
                            p.appendChild(document.createElement('br'));
                        }
                        p.appendChild(document.createTextNode(line));
                    });

                    notesContent.appendChild(p);
                });
            } else {
                const p = document.createElement('p');
                p.style.color = 'rgba(255,255,255,0.5)';
                p.style.fontStyle = 'italic';
                p.textContent = 'No notes for this slide';
                notesContent.appendChild(p);
            }
        }

        function toggleNotes() {
            notesVisible = !notesVisible;
            if (notesVisible) {
                notesPanel.classList.add('active');
            } else {
                notesPanel.classList.remove('active');
            }
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

        function openPresenter() {
            if (presenterWin && !presenterWin.closed) {
                presenterWin.focus();
                return;
            }

            const slidesData = Array.from(slides).map((slide) => ({
                content: slide.querySelector('.slide-content').innerHTML,
                notes: slide.getAttribute('data-notes') || ''
            }));

            presenterWin = window.open('', 'Presenter', 'width=1200,height=800');
            if (!presenterWin) {
                alert('The presenter window was blocked by your browser. Please allow pop-ups for this site and try again.');
                return;
            }
            presenterWin.document.write(buildPresenterHTML(slidesData));
            presenterWin.document.close();
        }

        function buildPresenterHTML(slidesData) {
            const lines = [];
            lines.push('<!DOCTYPE html><html><head><meta charset="UTF-8">');
            lines.push('<title>Presenter - ${title}</title>');
            lines.push('<style>');
            lines.push('* { margin: 0; padding: 0; box-sizing: border-box; }');
            lines.push('body { font-family: -apple-system, sans-serif; background: #1a1a1a; color: #fff; height: 100vh; overflow: hidden; }');
            lines.push('.container { display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: 60px 1fr; gap: 15px; padding: 15px; height: 100vh; }');
            lines.push('.header { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.5); padding: 0 20px; border-radius: 8px; }');
            lines.push('.timer { font-size: 2rem; font-family: monospace; }');
            lines.push('.counter { font-size: 1.2rem; }');
            lines.push('.controls button { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-left: 8px; }');
            lines.push('.controls button:hover { background: rgba(255,255,255,0.3); }');
            lines.push('.current { background: rgba(0,0,0,0.3); border-radius: 8px; padding: 20px; overflow: auto; }');
            lines.push('.preview-col { display: flex; flex-direction: column; gap: 15px; }');
            lines.push('.next, .notes { background: rgba(0,0,0,0.3); border-radius: 8px; padding: 15px; overflow: auto; flex: 1; }');
            lines.push('.title { font-size: 0.9rem; color: rgba(255,255,255,0.6); margin-bottom: 10px; text-transform: uppercase; }');
            lines.push('.content h1 { font-size: 1.8rem; margin: 10px 0; }');
            lines.push('.content h2 { font-size: 1.4rem; margin: 8px 0; }');
            lines.push('.content p { margin: 8px 0; line-height: 1.6; }');
            lines.push('.content ul { margin-left: 20px; }');
            lines.push('.next .content { opacity: 0.7; font-size: 0.85rem; }');
            lines.push('</style></head><body>');
            lines.push('<div class="container">');
            lines.push('<div class="header">');
            lines.push('<div class="counter">Slide <span id="curr">1</span> / <span id="tot">' + slidesData.length + '</span></div>');
            lines.push('<div class="timer" id="timer">00:00</div>');
            lines.push('<div class="controls">');
            lines.push('<button onclick="resetTimer()">Reset</button>');
            lines.push('<button onclick="prev()">Prev</button>');
            lines.push('<button onclick="next()">Next</button>');
            lines.push('</div></div>');
            lines.push('<div class="current"><div class="title">Current Slide</div><div class="content" id="current"></div></div>');
            lines.push('<div class="preview-col">');
            lines.push('<div class="next"><div class="title">Next Slide</div><div class="content" id="next"></div></div>');
            lines.push('<div class="notes"><div class="title">Notes</div><div id="notesTxt"></div></div>');
            lines.push('</div></div>');
            lines.push('<script>');
            lines.push('var data = ' + JSON.stringify(slidesData).replace(/<\/script/gi, '<\\/script') + ';');
            lines.push('var idx = ' + currentSlide + ';');
            lines.push('var start = Date.now();');
            lines.push('var ch = null;');
            lines.push('var channelName = ' + JSON.stringify(channelName) + ';');
            lines.push('if (typeof BroadcastChannel !== "undefined") {');
            lines.push('  try {');
            lines.push('    ch = new BroadcastChannel(channelName);');
            lines.push('  } catch (e) {');
            lines.push('    console.warn("BroadcastChannel not available in presenter window:", e);');
            lines.push('  }');
            lines.push('}');
            lines.push('if (ch) {');
            lines.push('  ch.onmessage = function(e) { if (e.data.type === "slideChange") { idx = e.data.index; update(); } };');
            lines.push('}');
            lines.push('function update() {');
            lines.push('  document.getElementById("curr").textContent = idx + 1;');
            lines.push('  document.getElementById("current").innerHTML = data[idx].content;');
            lines.push('  if (idx < data.length - 1) {');
            lines.push('    document.getElementById("next").innerHTML = data[idx + 1].content;');
            lines.push('  } else {');
            lines.push('    document.getElementById("next").innerHTML = "<p style=\\'opacity:0.5\\'>End</p>";');
            lines.push('  }');
            lines.push('  var n = data[idx].notes;');
            lines.push('  var notesEl = document.getElementById("notesTxt");');
            lines.push('  while (notesEl.firstChild) {');
            lines.push('    notesEl.removeChild(notesEl.firstChild);');
            lines.push('  }');
            lines.push('  if (n) {');
            lines.push('    var dec;');
            lines.push('    try {');
            lines.push('      dec = decodeURIComponent(n);');
            lines.push('    } catch (e) {');
            lines.push('      dec = n;');
            lines.push('    }');
            lines.push('    var parts = dec.split("\\\\n\\\\n");');
            lines.push('    for (var i = 0; i < parts.length; i++) {');
            lines.push('      var p = document.createElement("p");');
            lines.push('      var linesArr = parts[i].split("\\\\n");');
            lines.push('      for (var j = 0; j < linesArr.length; j++) {');
            lines.push('        if (j > 0) {');
            lines.push('          p.appendChild(document.createElement("br"));');
            lines.push('        }');
            lines.push('        p.appendChild(document.createTextNode(linesArr[j]));');
            lines.push('      }');
            lines.push('      notesEl.appendChild(p);');
            lines.push('    }');
            lines.push('  } else {');
            lines.push('    var p = document.createElement("p");');
            lines.push('    p.style.opacity = "0.5";');
            lines.push('    p.textContent = "No notes";');
            lines.push('    notesEl.appendChild(p);');
            lines.push('  }');
            lines.push('}');
            lines.push('function next() {');
            lines.push('  if (idx < data.length - 1) {');
            lines.push('    idx++;');
            lines.push('    update();');
            lines.push('    if (ch) ch.postMessage({type:"slideChange",index:idx});');
            lines.push('  }');
            lines.push('}');
            lines.push('function prev() {');
            lines.push('  if (idx > 0) {');
            lines.push('    idx--;');
            lines.push('    update();');
            lines.push('    if (ch) ch.postMessage({type:"slideChange",index:idx});');
            lines.push('  }');
            lines.push('}');
            lines.push('function resetTimer() { start = Date.now(); }');
            lines.push('function tick() {');
            lines.push('  var e = Math.floor((Date.now() - start) / 1000);');
            lines.push('  var m = String(Math.floor(e / 60)).padStart(2, "0");');
            lines.push('  var s = String(e % 60).padStart(2, "0");');
            lines.push('  document.getElementById("timer").textContent = m + ":" + s;');
            lines.push('}');
            lines.push('document.addEventListener("keydown", function(e) {');
            lines.push('  if (e.key === "ArrowRight" || e.key === " ") next();');
            lines.push('  else if (e.key === "ArrowLeft") prev();');
            lines.push('});');
            lines.push('setInterval(tick, 1000);');
            lines.push('update();');
            lines.push('<' + '/script></body></html>');
            return lines.join('\\n');
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                nextSlide();
            } else if (e.key === 'ArrowLeft') {
                prevSlide();
            } else if (e.key === 'n' || e.key === 'N') {
                toggleNotes();
            } else if (e.key === 'p' || e.key === 'P') {
                openPresenter();
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

    const { slides, notes } = parseMarkdownPresentation(inputPath);
    if (slides.length === 0) {
      throw new Error('No slides found');
    }

    const html = generateHtml(title, slides, notes);
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
