#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const brokenLinks = new Set();
const externalLinks = new Set();
const internalLinks = new Set();

// Get all HTML files
function getAllHtmlFiles(dir) {
	const files = [];
	function walk(currentPath) {
		const entries = fs.readdirSync(currentPath);
		for (const entry of entries) {
			const fullPath = path.join(currentPath, entry);
			const stat = fs.statSync(fullPath);
			if (stat.isDirectory()) {
				walk(fullPath);
			} else if (entry.endsWith('.html')) {
				files.push(fullPath);
			}
		}
	}
	walk(dir);
	return files;
}

// Extract links from HTML
function extractLinks(htmlContent) {
	const links = [];
	// Match href and src attributes
	const hrefRegex = /href=["']([^"']+)["']/g;
	const srcRegex = /src=["']([^"']+)["']/g;

	let match;
	while ((match = hrefRegex.exec(htmlContent)) !== null) {
		links.push(match[1]);
	}
	while ((match = srcRegex.exec(htmlContent)) !== null) {
		links.push(match[1]);
	}

	return links;
}

// Validate links
function validateLinks() {
	const htmlFiles = getAllHtmlFiles(distDir);
	console.log(`\n📊 Analyzing ${htmlFiles.length} HTML files...\n`);

	for (const file of htmlFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const links = extractLinks(content);
		const relativePath = path.relative(distDir, file);

		for (const link of links) {
			// Skip non-HTTP(S) links, anchors, and special links
			if (
				link.startsWith('#') ||
				link.startsWith('mailto:') ||
				link.startsWith('tel:') ||
				link.startsWith('data:') ||
				link.startsWith('javascript:')
			) {
				continue;
			}

			if (link.startsWith('http')) {
				// External link
				externalLinks.add(link);
			} else {
				// Internal link
				internalLinks.add(link);

				// Remove query strings and fragments for file checking
				const urlPart = link.split('?')[0].split('#')[0];

				// Static asset file extensions that should be checked as-is
				const staticAssetExtensions = [
					'.html', '.xml', '.svg',                    // Documents
					'.css', '.js', '.map',                       // Styles & Scripts
					'.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.ico',  // Images
					'.woff', '.woff2', '.ttf', '.eot',          // Fonts
					'.json', '.txt',                             // Data files
				];

				// Determine the actual file path
				let resolvedPath;
				const hasStaticExtension = staticAssetExtensions.some(ext => urlPart.endsWith(ext));

				// Handle relative paths (../ or ./)
				if (urlPart.startsWith('../') || urlPart.startsWith('./')) {
					// Resolve relative to the current file's directory
					const fileDir = path.dirname(file);
					resolvedPath = path.resolve(fileDir, urlPart);
				} else {
					// Absolute path from site root
					let normalizedPath;
					if (urlPart === '/' || urlPart === '') {
						normalizedPath = '/index.html';
					} else if (hasStaticExtension) {
						// File with recognized extension - use as-is
						normalizedPath = urlPart;
					} else {
						// Directory - add index.html
						normalizedPath = urlPart.endsWith('/') ? `${urlPart}index.html` : `${urlPart}/index.html`;
					}
					resolvedPath = path.join(distDir, normalizedPath);
				}

				if (!fs.existsSync(resolvedPath)) {
					brokenLinks.add({
						file: relativePath,
						link,
						resolvedPath: path.relative(distDir, resolvedPath),
					});
				}
			}
		}
	}

	// Report results
	console.log(`✅ Internal links found: ${internalLinks.size}`);
	console.log(`🌐 External links found: ${externalLinks.size}`);

	if (brokenLinks.size > 0) {
		console.log(`\n❌ Broken internal links: ${brokenLinks.size}\n`);
		for (const broken of brokenLinks) {
			console.log(`  File: ${broken.file}`);
			console.log(`  Link: ${broken.link}`);
			console.log(`  Missing: ${broken.resolvedPath}\n`);
		}
		process.exit(1);
	} else {
		console.log(`\n✅ No broken internal links found!\n`);
	}
}

validateLinks();
