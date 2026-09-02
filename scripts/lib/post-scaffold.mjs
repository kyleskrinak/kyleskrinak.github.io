/**
 * Shared helpers for scaffolding a blog post directory
 * (`src/content/blog/<slug>/index.md` + co-located images).
 *
 * Used by scripts/new-post.mjs (human-authored stub) and
 * scripts/migrate-notion-post.mjs (Notion-sourced draft).
 */
import { mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import sharp from 'sharp';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})-(.+)$/;
export const RASTER_TO_WEBP = new Set(['.jpg', '.jpeg', '.png']);
export const PASSTHROUGH_IMAGE_EXTS = new Set(['.webp', '.svg', '.gif', '.avif']);
export const RASTER_SHARP_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

export function todayUTCDate() {
	const now = new Date();
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, '0');
	const d = String(now.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function altFromBasename(name) {
	const stem = name.replace(/\.[^.]+$/, '');
	return stem.replace(/[-_]+/g, ' ').trim() || 'image';
}

/**
 * Converts/copies a source image file on disk into destDir.
 * Returns the basename written into destDir.
 */
export async function emitImage(src, destDir) {
	const ext = extname(src.name).toLowerCase();
	if (RASTER_TO_WEBP.has(ext)) {
		const outName = src.name.replace(/\.[^.]+$/, '') + '.webp';
		const outPath = join(destDir, outName);
		if (existsSync(outPath)) {
			throw new Error(`Output already exists: ${outPath}. Two source images share the output name "${outName}" — rename one before importing.`);
		}
		await sharp(src.full)
			.resize({ width: 2400, withoutEnlargement: true })
			.webp({ quality: 85 })
			.toFile(outPath);
		return outName;
	}
	// WebP / SVG / GIF / AVIF — copy as-is.
	const outName = src.name;
	const outPath = join(destDir, outName);
	if (existsSync(outPath)) {
		throw new Error(`Output already exists: ${outPath}. A converted raster and a passthrough file share the name "${outName}" — rename one before importing.`);
	}
	await copyFile(src.full, outPath);
	return outName;
}

/**
 * Converts an in-memory raster buffer to a WebP buffer using the same
 * pipeline as emitImage (max width 2400px, quality 85). Used by the Notion
 * migration script, which downloads images into memory before any
 * filesystem write happens (see scripts/migrate-notion-post.mjs).
 */
export async function convertImageBuffer(buffer) {
	return sharp(buffer)
		.resize({ width: 2400, withoutEnlargement: true })
		.webp({ quality: 85 })
		.toBuffer();
}

/**
 * Creates postDir, runs writeFn(postDir) to populate it, and — if writeFn
 * throws — removes the directory this call created before re-throwing.
 * Caller is responsible for checking postDir doesn't already exist first
 * (the two callers report that pre-flight failure differently: new-post.mjs
 * as a CLI usage error, migrate-notion-post.mjs as an idempotency no-op).
 */
export async function createPostDirectory(postDir, writeFn) {
	let dirCreatedByUs = false;
	try {
		await mkdir(postDir);
		dirCreatedByUs = true;
		await writeFn(postDir);
	} catch (err) {
		if (dirCreatedByUs) {
			await rm(postDir, { recursive: true, force: true }).catch((rmErr) => {
				console.warn(`Warning: could not remove ${postDir}: ${rmErr.message}`);
				console.warn('Remove it manually before retrying.');
			});
		}
		throw err;
	}
}

export async function writePostIndex(postDir, frontmatterYaml, body) {
	const content = `---\n${frontmatterYaml}---\n${body}`;
	const indexPath = join(postDir, 'index.md');
	await writeFile(indexPath, content, 'utf8');
	return indexPath;
}
