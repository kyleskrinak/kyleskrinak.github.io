#!/usr/bin/env node
/**
 * Guard against regressions to the pre-migration image layout.
 *
 * Modes:
 *   (default)  Inspect staged files. Used by the Husky pre-commit hook.
 *              Requires git (we're in a git hook by definition).
 *   --all      Inspect every relevant file in the working tree. Used by
 *              `npm run build` and build:ci. Walks src/content/ and
 *              public/assets/ via fs so it works in stripped environments
 *              (e.g., the local Docker pre-push container has no git).
 *
 * Blocks (exit 1):
 *   1. Any added/modified file under public/assets/  — that tree was removed.
 *   2. Any post markdown (src/content/**\/*.{md,mdx}) referencing legacy paths:
 *        src="/assets/..."         (raw HTML pointing at deleted public/assets/)
 *        ](../../assets/images/... (markdown image pointing at deleted src/assets/images/)
 *
 * Warns (print, do not fail):
 *   3. Post-co-located images > 5 MB (all formats). This is a floor, not a
 *      target — dimension-aware checks happen at ingestion in new-post.mjs.
 *   4. Post-co-located JPG/PNG (src/content/**\/*.{jpg,jpeg,png}) without a
 *      `.original.{jpg,png}` suffix — suggests converting to WebP.
 *
 * Bypass (only when truly necessary): git commit --no-verify
 */
import { execFileSync } from 'node:child_process';
import { statSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

const args = process.argv.slice(2);
const mode = args.includes('--all') ? 'all' : 'staged';

const PUBLIC_ASSETS_RE = /^public\/assets\//;
const POST_MD_RE = /^src\/content\/.+\.(md|mdx)$/;
const POST_IMG_RE = /^src\/content\/.+\.(jpe?g|png|webp|gif|svg|avif)$/i;
const POST_RASTER_LEGACY_RE = /^src\/content\/.+\.(jpe?g|png)$/i;
const ORIGINAL_RASTER_RE = /\.original\.(jpe?g|png)$/i;

const LEGACY_HTML_SRC_RE = /\bsrc=["']\/assets\//;
const LEGACY_MD_PATH_RE = /\]\(\.\.\/\.\.\/assets\/images\//;

// 5 MB floor: not a target, just a regression guard for egregiously large sources.
// Dimension-aware checks happen at ingestion time in new-post.mjs.
const MAX_EGREGIOUS_BYTES = 5 * 1024 * 1024;

const blocks = [];
const warns = [];

function git(...args) {
	return execFileSync('git', args, { encoding: 'utf8' });
}

function listStagedFiles() {
	// Added / Copied / Modified / Renamed — exclude deletions.
	const out = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z');
	return out.split('\0').filter(Boolean);
}

function listAllRelevantFiles() {
	// All checks are scoped to src/content/ and public/assets/, so walk only
	// those. This avoids the need for git in --all mode (the Docker pre-push
	// container has none) while still inspecting every file a check can match.
	const roots = ['src/content', 'public/assets'];
	const out = [];
	for (const root of roots) {
		if (!existsSync(root)) continue;
		walk(root, out);
	}
	return out;
}

function walk(dir, out) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, out);
		} else if (entry.isFile()) {
			out.push(full.split(sep).join('/'));
		}
	}
}

function readStagedContent(path) {
	try {
		return execFileSync('git', ['show', `:${path}`], { encoding: 'utf8' });
	} catch {
		// File may have been staged then unstaged, or is binary.
		return null;
	}
}

function readWorkingContent(path) {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return null;
	}
}

function fileSize(path) {
	try {
		return statSync(path).size;
	} catch {
		return null;
	}
}

function checkFile(path, getContent) {
	if (PUBLIC_ASSETS_RE.test(path)) {
		blocks.push(`public/assets/ no longer exists — do not add new files there: ${path}`);
		return;
	}

	if (POST_MD_RE.test(path)) {
		const content = getContent(path);
		if (content !== null) {
			const lines = content.split('\n');
			lines.forEach((line, i) => {
				if (LEGACY_HTML_SRC_RE.test(line)) {
					blocks.push(`${path}:${i + 1} — legacy raw-asset URL (src="/assets/..."). Use ./relative.webp in the post directory.`);
				}
				if (LEGACY_MD_PATH_RE.test(line)) {
					blocks.push(`${path}:${i + 1} — legacy markdown image path (../../assets/images/...). Use ./relative.webp in the post directory.`);
				}
			});
		}
	}

	if (POST_IMG_RE.test(path)) {
		const size = fileSize(path);
		if (size !== null && size > MAX_EGREGIOUS_BYTES) {
			const mb = (size / (1024 * 1024)).toFixed(1);
			warns.push(`${path} — ${mb} MB exceeds 5 MB floor. Web image sources should not be this large.`);
		}
	}

	if (POST_RASTER_LEGACY_RE.test(path) && !ORIGINAL_RASTER_RE.test(path)) {
		warns.push(`${path} — JPG/PNG in a post directory. Convert to WebP, or rename to *.original.{jpg,png} if intentional.`);
	}
}

function main() {
	const files = mode === 'all' ? listAllRelevantFiles() : listStagedFiles();
	const getContent = mode === 'all' ? readWorkingContent : readStagedContent;

	for (const path of files) {
		checkFile(path, getContent);
	}

	if (warns.length > 0) {
		console.warn('Image-convention warnings:');
		for (const w of warns) console.warn(`  ⚠  ${w}`);
		console.warn('');
	}

	if (blocks.length > 0) {
		console.error('Image-convention violations (blocking):');
		for (const b of blocks) console.error(`  ✖  ${b}`);
		console.error('');
		console.error(`Bypass only when necessary: git commit --no-verify`);
		process.exit(1);
	}

	if (mode === 'all') {
		console.log(`check-image-conventions: ${files.length} files inspected, ${warns.length} warning(s), 0 violations.`);
	}
}

main();
