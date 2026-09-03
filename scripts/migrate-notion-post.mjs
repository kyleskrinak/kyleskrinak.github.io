#!/usr/bin/env node
/**
 * Migrate the oldest "ready to post" page in the Notion Blog Backlog
 * database into a new src/content/blog/<slug>/ directory.
 *
 * Usage:
 *   node scripts/migrate-notion-post.mjs [--dry-run]
 *
 * --dry-run: skip the `gh pr list` open-PR guard (no GitHub context needed
 * locally) — everything else (Notion read, file write) still runs, so the
 * generated post can be inspected by hand. Does not perform any Notion
 * write-back itself; write-back is always a separate step (see
 * scripts/notion-writeback.mjs), invoked by the workflow only after a PR is
 * confirmed created.
 *
 * Env vars:
 *   NOTION_API_TOKEN                    required
 *   NOTION_BLOG_BACKLOG_DATA_SOURCE_ID   required
 *   GH_TOKEN                            required unless --dry-run
 *   GITHUB_OUTPUT                       optional; if unset, outputs are logged
 *
 * Exits 0 with no output written when there is nothing to migrate, or when
 * the selected page has already been migrated (idempotency guards below).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readdir, appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import kebabcase from 'lodash.kebabcase';
import slugify from 'slugify';
import { Client } from '@notionhq/client';
import {
	SLUG_RE,
	DATE_PREFIX_RE,
	todayUTCDate,
	convertImageBuffer,
	createPostDirectory,
	writePostIndex,
} from './lib/post-scaffold.mjs';

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const BLOG_DIR = join(ROOT, 'src/content/blog');
const DATA_SOURCE_ID = process.env.NOTION_BLOG_BACKLOG_DATA_SOURCE_ID;

// Mirrors src/utils/slugify.ts's hybrid algorithm exactly. Reimplemented
// here (not imported) because scripts/ is plain Node ESM with no TS loader.
function hasNonLatin(str) {
	return /[^\x00-\x7F]/.test(str);
}
function slugifyStr(str) {
	const normalized = str.replace(/\+/g, ' plus ');
	if (hasNonLatin(normalized)) {
		return kebabcase(normalized);
	}
	return slugify(normalized, { lower: true });
}

function parseArgs(argv) {
	const opts = { dryRun: false };
	for (const a of argv) {
		if (a === '--dry-run') opts.dryRun = true;
		else throw new Error(`Unknown flag: ${a}`);
	}
	return opts;
}

async function writeOutput(name, value) {
	if (process.env.GITHUB_OUTPUT) {
		// Multiline-safe form (GitHub Actions "heredoc" output syntax). The
		// simple NAME=value form corrupts GITHUB_OUTPUT if value contains a
		// newline (e.g. a Notion title with a line break) — a random
		// delimiter avoids collisions with the value's own content.
		const delimiter = `ghadelimiter_${randomUUID()}`;
		await appendFile(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
	} else {
		console.log(`[output] ${name}=${value}`);
	}
}

function plainTextTitle(page) {
	const richText = page.properties?.Name?.title ?? [];
	// Notion titles can contain soft line breaks; collapse all whitespace
	// (not just leading/trailing) so PR titles, issue titles, and logs
	// stay single-line and stable.
	return richText.map(t => t.plain_text).join('').replace(/\s+/g, ' ').trim();
}

function postUrlValue(page) {
	return page.properties?.['Post URL']?.url ?? null;
}

// Plain-text extraction with no Markdown formatting applied — required for
// code block contents (where backticks/bold/link syntax would corrupt the
// code or break fence structure) and for any value going into GitHub
// metadata or frontmatter, where Markdown isn't wanted or would be unsafe.
function richTextToPlainText(richText) {
	return (richText ?? []).map(t => t.plain_text).join('');
}

// A fixed triple-backtick fence breaks if the code itself contains a run of
// 3+ backticks (the fence would terminate early). Use a fence one backtick
// longer than the longest backtick run in the content, minimum 3.
function fenceFor(code) {
	const runs = code.match(/`+/g) ?? [];
	const longest = runs.reduce((max, r) => Math.max(max, r.length), 0);
	return '`'.repeat(Math.max(3, longest + 1));
}

// Notion link hrefs are untrusted external input — same rationale as
// safeHttpUrl() in src/components/Webmentions.astro: reject anything that
// isn't http(s) so a "javascript:"/"data:" URL can't be emitted into a
// generated post. Notion hrefs are always absolute (not repo-relative), so
// an http(s)-only allowlist doesn't risk breaking valid relative links.
function safeHttpUrl(url) {
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
	} catch {
		return null;
	}
}

function richTextToMarkdown(richText) {
	return (richText ?? []).map(t => {
		let s = t.plain_text;
		if (t.annotations?.code) s = `\`${s}\``;
		if (t.annotations?.bold) s = `**${s}**`;
		if (t.annotations?.italic) s = `*${s}*`;
		if (t.href) {
			const safeHref = safeHttpUrl(t.href);
			// Escape `]` in the link text so it can't prematurely close the
			// Markdown link-text slot and corrupt the surrounding syntax.
			// Wrap the destination in angle brackets — CommonMark treats a
			// bare destination as ending at whitespace or an unbalanced
			// `)`, both of which a real URL can contain.
			if (safeHref) s = `[${s.replace(/\]/g, '\\]')}](<${safeHref}>)`;
		}
		return s;
	}).join('');
}

async function fetchAllBlocks(notion, blockId) {
	const blocks = [];
	let cursor;
	do {
		const res = await notion.blocks.children.list({ block_id: blockId, start_cursor: cursor });
		blocks.push(...res.results);
		cursor = res.has_more ? res.next_cursor : undefined;
	} while (cursor);
	return blocks;
}

const SUPPORTED_BLOCK_TYPES = new Set([
	'paragraph', 'heading_1', 'heading_2', 'heading_3',
	'bulleted_list_item', 'numbered_list_item',
	'code', 'quote', 'divider', 'image',
]);

/**
 * Fetches page blocks and downloads every image into memory, converting
 * each to a WebP buffer. No filesystem write happens here — per the plan's
 * atomicity requirement, all Notion reads must complete before the file
 * write step begins, so a failed fetch never leaves a partial directory to
 * clean up.
 */
async function fetchContentAndImages(notion, pageId) {
	const blocks = await fetchAllBlocks(notion, pageId);
	const images = []; // { buffer, name, alt }
	const lines = [];
	let listCounter = 0;

	for (const block of blocks) {
		const type = block.type;
		if (!SUPPORTED_BLOCK_TYPES.has(type)) {
			lines.push(`<!-- MIGRATION: unsupported block "${type}" omitted -->`, '');
			console.warn(`Unsupported block type "${type}" — inserted marker, review manually.`);
			listCounter = 0;
			continue;
		}

		if (type !== 'numbered_list_item') listCounter = 0;

		switch (type) {
			case 'paragraph':
				lines.push(richTextToMarkdown(block.paragraph.rich_text));
				break;
			case 'heading_1':
				lines.push(`# ${richTextToMarkdown(block.heading_1.rich_text)}`);
				break;
			case 'heading_2':
				lines.push(`## ${richTextToMarkdown(block.heading_2.rich_text)}`);
				break;
			case 'heading_3':
				lines.push(`### ${richTextToMarkdown(block.heading_3.rich_text)}`);
				break;
			case 'bulleted_list_item':
				lines.push(`- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`);
				break;
			case 'numbered_list_item':
				listCounter += 1;
				lines.push(`${listCounter}. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`);
				break;
			case 'code': {
				const lang = block.code.language ?? '';
				// Plain text only — running code content through
				// richTextToMarkdown() would inject backticks/bold/link
				// syntax into the code and can break the fence itself.
				const code = richTextToPlainText(block.code.rich_text);
				const fence = fenceFor(code);
				lines.push(`${fence}${lang}\n${code}\n${fence}`);
				break;
			}
			case 'quote':
				lines.push(richTextToMarkdown(block.quote.rich_text).split('\n').map(l => `> ${l}`).join('\n'));
				break;
			case 'divider':
				lines.push('---');
				break;
			case 'image': {
				const img = block.image;
				const url = img.type === 'external' ? img.external.url : img.file.url;
				// Plain text, not Markdown — this value also lands in the
				// post's frontmatter `alt` field, where Markdown syntax
				// (links, formatting) would be invalid/unwanted.
				const captionText =
					richTextToPlainText(img.caption).replace(/\s+/g, ' ').trim() || `image ${images.length + 1}`;
				const res = await fetch(url);
				if (!res.ok) {
					throw new Error(`Failed to download Notion image (${res.status}): ${url}`);
				}
				const buffer = Buffer.from(await res.arrayBuffer());
				const webpBuffer = await convertImageBuffer(buffer);
				const outName = `image-${images.length + 1}.webp`;
				images.push({ buffer: webpBuffer, name: outName, alt: captionText });
				// Escape `]` so a caption containing a literal bracket can't
				// prematurely close the Markdown alt-text slot.
				lines.push(`![${captionText.replace(/\]/g, '\\]')}](./${outName})`);
				break;
			}
		}
		if (block.has_children) {
			// Nested children (indented sub-blocks: toggles, nested lists,
			// callouts, etc.) are never fetched here — fetchAllBlocks only
			// walks the page's top-level block list — so flag the gap
			// instead of silently dropping the nested content.
			lines.push(`<!-- MIGRATION: nested content under this ${type} block was omitted — review in Notion -->`);
			console.warn(`Block "${type}" has nested children that were not migrated — inserted marker, review manually.`);
		}
		lines.push('');
	}

	return { markdown: lines.join('\n').trim() + '\n', images };
}

// Both guards below key off slugStem (the title-derived slug with no date
// prefix), not the full date-prefixed slug — the slug embeds today's date,
// so a rerun on a later day for the same Notion page would otherwise derive
// a different slug and silently defeat the idempotency check.

async function directoryExistsForSlug(slugStem) {
	const entries = await readdir(BLOG_DIR).catch(() => []);
	return entries.some(name => {
		const match = name.match(DATE_PREFIX_RE);
		return match ? match[2] === slugStem : name === slugStem;
	});
}

async function openPrExistsForSlug(slugStem) {
	try {
		const { stdout } = await execFileAsync('gh', ['pr', 'list', '--state', 'open', '--json', 'headRefName', '--limit', '100']);
		const branchRe = new RegExp(`^automation/notion-(?:\\d{4}-\\d{2}-\\d{2}-)?${slugStem}$`);
		return JSON.parse(stdout).some(pr => branchRe.test(pr.headRefName));
	} catch (err) {
		throw new Error(`Failed to check for an existing open PR (slug stem "${slugStem}"): ${err.message}`);
	}
}

async function main() {
	let opts;
	try {
		opts = parseArgs(process.argv.slice(2));
	} catch (err) {
		console.error(err.message);
		process.exit(2);
	}

	if (!process.env.NOTION_API_TOKEN) {
		console.error('NOTION_API_TOKEN environment variable is required.');
		process.exit(1);
	}
	if (!DATA_SOURCE_ID) {
		console.error('NOTION_BLOG_BACKLOG_DATA_SOURCE_ID environment variable is required.');
		process.exit(1);
	}
	if (!opts.dryRun && !process.env.GH_TOKEN) {
		console.error('GH_TOKEN environment variable is required (used for the open-PR idempotency guard). Pass --dry-run to skip it locally.');
		process.exit(1);
	}

	const notion = new Client({ auth: process.env.NOTION_API_TOKEN });

	const queryRes = await notion.dataSources.query({
		data_source_id: DATA_SOURCE_ID,
		filter: { property: 'Status', select: { equals: 'ready to post' } },
		sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
		page_size: 1,
	});

	if (queryRes.results.length === 0) {
		console.log('Nothing to migrate — no page with Status "ready to post".');
		return;
	}

	const page = queryRes.results[0];
	const title = plainTextTitle(page);
	if (!title) {
		throw new Error(`Page ${page.id} has an empty Name/title — cannot derive a slug.`);
	}

	// Emit page id + title as early as possible so a failure anywhere below
	// still lets the workflow's failure-reporting steps target this page.
	await writeOutput('notion-page-id', page.id);
	await writeOutput('title', title);

	const slugStem = slugifyStr(title);
	const slug = `${todayUTCDate()}-${slugStem}`;
	if (!SLUG_RE.test(slugStem)) {
		throw new Error(`Derived slug "${slug}" is invalid after slugifying title "${title}".`);
	}
	await writeOutput('slug', slug);

	// Idempotency guards, in order (see plan for why each is needed).
	if (await directoryExistsForSlug(slugStem)) {
		console.log(`A post directory for "${slugStem}" already exists — already migrated, skipping.`);
		return;
	}
	const existingPostUrl = postUrlValue(page);
	if (existingPostUrl) {
		console.log(`Page ${page.id} already has a Post URL (${existingPostUrl}) — skipping.`);
		return;
	}
	if (!opts.dryRun && await openPrExistsForSlug(slugStem)) {
		console.log(`An open PR already exists for "${slugStem}" — skipping.`);
		return;
	}

	// All Notion reads (block walk + image downloads) complete, fully in
	// memory, before any filesystem write begins below.
	const { markdown, images } = await fetchContentAndImages(notion, page.id);

	const postDir = join(BLOG_DIR, slug);
	await createPostDirectory(postDir, async (dir) => {
		for (const img of images) {
			await writeFile(join(dir, img.name), img.buffer);
		}

		const frontmatter = {
			title,
			pubDate: `${todayUTCDate()}T00:00:00.000Z`,
			tags: [],
			published: false,
		};
		if (images.length > 0) {
			frontmatter.image = `./${images[0].name}`;
			frontmatter.alt = images[0].alt;
		}

		const fm = stringifyYaml(frontmatter);
		const indexPath = await writePostIndex(dir, fm, `\n${markdown}`);
		console.log(`Created ${indexPath}`);
	});

	// SITE_URL override, production default — same pattern as
	// scripts/send-webmentions.mjs, so the canonical domain stays
	// single-sourced if it ever changes.
	const siteUrl = (process.env.SITE_URL || 'https://kyle.skrinak.com/').replace(/\/+$/, '');
	const postUrl = `${siteUrl}/posts/${slug}/`;
	await writeOutput('post-url', postUrl);

	console.log(`Migrated Notion page ${page.id} -> ${postDir}`);
}

main().catch(err => {
	console.error(err.stack || err.message || err);
	process.exit(1);
});
