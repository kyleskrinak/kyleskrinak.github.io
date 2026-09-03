#!/usr/bin/env node
/**
 * Write migration status back to a Notion "Blog Backlog" page.
 *
 * Two mutually exclusive modes:
 *
 *   node scripts/notion-writeback.mjs --page-id <id> --url <url> --status <status>
 *     Success path — sets Post URL and Status (e.g. "in review").
 *
 *   node scripts/notion-writeback.mjs --page-id <id> --next-action <text>
 *     Failure path — sets Next Action so a human scanning the database sees
 *     the stuck page without needing to check GitHub Actions.
 *
 * Requires NOTION_API_TOKEN in the environment.
 */
import { Client } from '@notionhq/client';

const FLAGS = new Set(['--page-id', '--url', '--status', '--next-action']);

function parseArgs(argv) {
	const opts = { pageId: null, url: null, status: null, nextAction: null };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!FLAGS.has(a)) throw new Error(`Unknown flag: ${a}`);
		const value = argv[++i];
		// Guard against a flag being last (value undefined) or immediately
		// followed by another flag (value would silently become that flag's
		// name) — both would otherwise leave opts fields undefined and let
		// mode detection below produce confusing errors.
		if (value === undefined || FLAGS.has(value)) {
			throw new Error(`${a} requires a value`);
		}
		if (a === '--page-id') opts.pageId = value;
		else if (a === '--url') opts.url = value;
		else if (a === '--status') opts.status = value;
		else if (a === '--next-action') opts.nextAction = value;
	}
	return opts;
}

function usage() {
	return [
		'Usage:',
		'  node scripts/notion-writeback.mjs --page-id <id> --url <url> --status <status>',
		'  node scripts/notion-writeback.mjs --page-id <id> --next-action <text>',
	].join('\n');
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

	if (!opts.pageId) {
		console.error('--page-id is required');
		console.error(usage());
		process.exit(2);
	}

	const successMode = opts.url !== null || opts.status !== null;
	const failureMode = opts.nextAction !== null;
	if (successMode === failureMode) {
		console.error(
			successMode
				? 'Pass either (--url and --status) or --next-action, not both.'
				: 'Pass exactly one mode: (--url and --status) or --next-action.'
		);
		console.error(usage());
		process.exit(2);
	}
	if (successMode && (!opts.url || !opts.status)) {
		console.error('--url and --status must both be set together.');
		process.exit(2);
	}

	if (!process.env.NOTION_API_TOKEN) {
		console.error('NOTION_API_TOKEN environment variable is required.');
		process.exit(1);
	}

	const notion = new Client({ auth: process.env.NOTION_API_TOKEN });

	const properties = successMode
		? {
			'Post URL': { url: opts.url },
			Status: { select: { name: opts.status } },
		}
		: {
			'Next Action': { rich_text: [{ text: { content: opts.nextAction } }] },
		};

	await notion.pages.update({ page_id: opts.pageId, properties });

	console.log(successMode
		? `Updated Notion page ${opts.pageId}: Post URL + Status "${opts.status}"`
		: `Updated Notion page ${opts.pageId}: Next Action "${opts.nextAction}"`);
}

main().catch(err => {
	console.error(err.stack || err.message || err);
	process.exit(1);
});
