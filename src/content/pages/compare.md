---
title: Local vs Production Comparison
author: Kyle Skrinak
permalink: /compare/
toc: false
---


<style>
  .controls {
    background: white;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .nav-buttons {
    display: flex;
    gap: 0.5rem;
  }

  button {
    padding: 0.5rem 1rem;
    background: #0092ca;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  button:hover {
    background: #006a96;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .page-info {
    font-size: 0.9rem;
    color: #666;
  }

  .url-display {
    font-family: monospace;
    font-size: 0.85rem;
    color: #333;
    background: #f0f0f0;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    flex: 1;
    min-width: 300px;
  }

  .comparison {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    height: calc(100vh - 150px);
  }

  .frame-wrapper {
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    height: 100%;
  }

  .frame-label {
    background: #f9f9f9;
    padding: 0.75rem;
    font-weight: bold;
    font-size: 0.9rem;
    border-bottom: 1px solid #eee;
    color: #333;
    flex-shrink: 0;
  }

  iframe {
    flex: 1;
    border: none;
    display: block;
    width: 100%;
    height: 100%;
  }

  @media (max-width: 1200px) {
    .comparison {
      grid-template-columns: 1fr;
    }
  }

  .error {
    color: #d32f2f;
    padding: 1rem;
    background: #ffebee;
    border-radius: 4px;
    margin-top: 1rem;
  }
</style>

<div class="controls">
  <div class="nav-buttons">
    <button id="prevBtn" onclick="previousPage()">← Previous</button>
    <button id="nextBtn" onclick="nextPage()">Next →</button>
  </div>
  <div class="page-info">
    Page <span id="currentPage">1</span> of <span id="totalPages">0</span>
  </div>
  <div class="url-display" id="urlDisplay">Loading...</div>
</div>

<div class="comparison">
  <div class="frame-wrapper">
    <div class="frame-label">Local (localhost:4000)</div>
    <iframe id="localFrame" src="about:blank"></iframe>
  </div>
  <div class="frame-wrapper">
    <div class="frame-label">Production (kyle.skrinak.com)</div>
    <iframe id="prodFrame" src="about:blank"></iframe>
  </div>
</div>

<script>
  const LOCAL_BASE = 'http://localhost:4000';
  const PROD_BASE = 'https://kyle.skrinak.com';
  let pages = [];
  let currentIndex = 0;

  async function fetchSitemapPaths(base) {
    try {
      console.log(`Fetching sitemap from ${base}/sitemap.xml`);
      const response = await fetch(`${base}/sitemap.xml`);
      console.log(`Response status: ${response.status}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const xml = await response.text();
      console.log(`Received XML length: ${xml.length}`);
      
      const paths = [];
      const regex = /<loc>([^<]+)<\/loc>/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        try {
          const url = new URL(match[1]);
          const pathname = url.pathname;
          if (pathname && pathname !== '/') {
            paths.push(pathname);
          }
        } catch (e) {
          console.warn(`Failed to parse URL: ${match[1]}`, e);
        }
      }
      
      console.log(`Found ${paths.length} paths from ${base}:`, paths.slice(0, 5));
      return paths;
    } catch (err) {
      console.error(`Error fetching sitemap from ${base}:`, err);
      return [];
    }
  }

  async function initialize() {
    // Fetch local sitemap only (doesn't have CORS issues)
    const localPaths = await fetchSitemapPaths(LOCAL_BASE);
    
    console.log(`After fetch - localPaths.length: ${localPaths.length}`);
    console.log(`All local paths:`, localPaths);

    if (localPaths.length === 0) {
      document.querySelector('.comparison').innerHTML = 
        '<div class="error"><strong>Error:</strong> Failed to fetch local sitemap or no paths found. Make sure localhost:4000 is running. Check console for details.</div>';
      return;
    }

    // Use local paths for both (will compare same URLs on local and production)
    pages = localPaths.sort();

    document.getElementById('totalPages').textContent = pages.length;
    loadPage();
  }

  function loadPage() {
    const path = pages[currentIndex];
    const localUrl = `${LOCAL_BASE}${path}`;
    const prodUrl = `${PROD_BASE}${path}`;

    document.getElementById('currentPage').textContent = currentIndex + 1;
    document.getElementById('urlDisplay').textContent = path;
    document.getElementById('localFrame').src = localUrl;
    document.getElementById('prodFrame').src = prodUrl;

    document.getElementById('prevBtn').disabled = currentIndex === 0;
    document.getElementById('nextBtn').disabled = currentIndex === pages.length - 1;
  }

  function nextPage() {
    if (currentIndex < pages.length - 1) {
      currentIndex++;
      loadPage();
    }
  }

  function previousPage() {
    if (currentIndex > 0) {
      currentIndex--;
      loadPage();
    }
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nextPage();
    if (e.key === 'ArrowLeft') previousPage();
  });

  initialize();
</script>
