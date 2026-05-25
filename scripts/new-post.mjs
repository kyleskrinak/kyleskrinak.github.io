#!/usr/bin/env node
/**
 * Scaffold a new blog post as a co-located directory.
 *
 *   src/content/blog/<slug>/
 *   ├── index.md
 *   └── <optional co-located images>
 *
 * Usage:
 *   node scripts/new-post.mjs <slug>
 *   node scripts/new-post.mjs <slug> --images <source-dir>
 *
 * With --images: every image in <source-dir> is copied into the post
 * directory. JPG/PNG are converted to WebP (quality 85, max width 1200px)
 * via the project's existing sharp dependency. WebP/SVG/GIF are copied
 * as-is. The first image becomes the frontmatter `image:` and the rest
 * are emitted as inline `![alt](./<basename>)` references in the body.
 */
import { readdir, mkdir, copyFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname, resolve } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import sharp from 'sharp';

const ROOT = process.cwd();
const BLOG_DIR = join(ROOT, 'src/content/blog');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})-(.+)$/;
const RASTER_TO_WEBP = new Set(['.jpg', '.jpeg', '.png']);
const PASSTHROUGH_IMAGE_EXTS = new Set(['.webp', '.svg', '.gif', '.avif']);

function parseArgs(argv) {
	const opts = { slug: null, imagesDir: null };
	const rest = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--images') {
			opts.imagesDir = argv[++i];
			if (!opts.imagesDir) {
				throw new Error('--images requires a directory path');
			}
		} else if (a === '--help' || a === '-h') {
			opts.help = true;
		} else if (a.startsWith('--')) {
			throw new Error(`Unknown flag: ${a}`);
		} else {
			rest.push(a);
		}
	}
	if (rest.length > 1) {
		throw new Error(`Only one slug allowed; got: ${rest.join(', ')}`);
	}
	opts.slug = rest[0] ?? null;
	return opts;
}

function usage() {
	return [
		'Usage:',
		'  npm run new-post -- <slug>',
		'  npm run new-post -- <slug> --images <source-dir>',
		'',
		'Slug must be lowercase-kebab-case, optionally prefixed with YYYY-MM-DD-.',
	].join('\n');
}

function todayUTCDate() {
	const now = new Date();
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, '0');
	const d = String(now.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function deriveTitle(slug) {
	const m = slug.match(DATE_PREFIX_RE);
	const stem = m ? m[2] : slug;
	return stem
		.split('-')
		.filter(Boolean)
		.map(w => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function altFromBasename(name) {
	const stem = name.replace(/\.[^.]+$/, '');
	return stem.replace(/[-_]+/g, ' ').trim() || 'image';
}

async function listSourceImages(dir) {
	const entries = await readdir(dir);
	const out = [];
	for (const name of entries) {
		const full = join(dir, name);
		const s = await stat(full);
		if (!s.isFile()) continue;
		const ext = extname(name).toLowerCase();
		if (!RASTER_TO_WEBP.has(ext) && !PASSTHROUGH_IMAGE_EXTS.has(ext)) continue;
		out.push({ name, full, ext });
	}
	out.sort((a, b) => a.name.localeCompare(b.name));
	return out;
}

async function emitImage(src, destDir) {
	// Returns the basename written into destDir.
	const ext = extname(src.name).toLowerCase();
	if (RASTER_TO_WEBP.has(ext)) {
		const outName = src.name.replace(/\.[^.]+$/, '') + '.webp';
		const outPath = join(destDir, outName);
		await sharp(src.full)
			.resize({ width: 1200, withoutEnlargement: true })
			.webp({ quality: 85 })
			.toFile(outPath);
		return outName;
	}
	// WebP / SVG / GIF / AVIF — copy as-is.
	const outName = src.name;
	await copyFile(src.full, join(destDir, outName));
	return outName;
}

async function main() {
	let opts;
	try {
		opts = parseArgs(process.argv.slice(2));
	} catch (err) {
		console.error(err.message);
		console.error(usage());
		process.exit(2);
	}

	if (opts.help || !opts.slug) {
		console.log(usage());
		process.exit(opts.help ? 0 : 2);
	}

	if (!SLUG_RE.test(opts.slug)) {
		console.error(`Invalid slug: "${opts.slug}"`);
		console.error('Slug must be lowercase letters, digits, and hyphens (e.g., 2026-05-25-my-post).');
		process.exit(2);
	}

	const postDir = join(BLOG_DIR, opts.slug);
	if (existsSync(postDir)) {
		console.error(`Post directory already exists: ${postDir}`);
		process.exit(1);
	}

	let imagesDirAbs = null;
	if (opts.imagesDir) {
		imagesDirAbs = resolve(opts.imagesDir);
		if (!existsSync(imagesDirAbs)) {
			console.error(`--images directory not found: ${imagesDirAbs}`);
			process.exit(1);
		}
		const s = await stat(imagesDirAbs);
		if (!s.isDirectory()) {
			console.error(`--images path is not a directory: ${imagesDirAbs}`);
			process.exit(1);
		}
	}

	await mkdir(postDir, { recursive: true });

	const writtenImages = [];
	if (imagesDirAbs) {
		const sources = await listSourceImages(imagesDirAbs);
		if (sources.length === 0) {
			console.warn(`No supported images found in ${imagesDirAbs} (jpg, jpeg, png, webp, svg, gif, avif).`);
		}
		for (const src of sources) {
			const outName = await emitImage(src, postDir);
			writtenImages.push(outName);
			console.log(`  + ${outName}`);
		}
	}

	const frontmatter = {
		title: deriveTitle(opts.slug),
		pubDate: `${todayUTCDate()}T00:00:00.000Z`,
		tags: [],
		published: false,
	};
	let bodyImages = '';
	if (writtenImages.length > 0) {
		const [hero, ...rest] = writtenImages;
		frontmatter.image = `./${hero}`;
		frontmatter.alt = altFromBasename(hero);
		if (rest.length > 0) {
			bodyImages = '\n' + rest.map(n => `![${altFromBasename(n)}](./${n})`).join('\n\n') + '\n';
		}
	}

	const fm = stringifyYaml(frontmatter);
	const content = `---\n${fm}---\n${bodyImages}\n`;
	const indexPath = join(postDir, 'index.md');
	await writeFile(indexPath, content, 'utf8');

	console.log(`\nCreated ${indexPath}`);
	if (writtenImages.length > 0) {
		console.log(`Images: ${writtenImages.length} (hero: ${writtenImages[0]})`);
	}
}

main().catch(err => {
	console.error(err.stack || err.message || err);
	process.exit(1);
});
