// Every post directory must be lowercase-kebab-case. getPath() builds the URL
// from post.id without lowercasing it, and production serves from S3, whose
// keys are case-sensitive: a mixed-case directory ships a mixed-case URL that
// 404s when anyone links it in lowercase. macOS's case-insensitive filesystem
// hides the mismatch locally. new-post and migrate-notion-post already reject
// such slugs; this test catches a post created or renamed by hand.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { SLUG_RE } from '../../scripts/lib/post-scaffold.mjs';

const BLOG_DIR = join(process.cwd(), 'src/content/blog');
const ENTRY_RE = /\.(md|mdx)$/;

describe('blog post paths', () => {
	const entries = readdirSync(BLOG_DIR, { recursive: true })
		.filter(p => ENTRY_RE.test(p))
		.map(p => relative(BLOG_DIR, join(BLOG_DIR, p)));

	it('finds post entries to check', () => {
		assert.ok(entries.length > 0, `No .md/.mdx entries under ${BLOG_DIR}`);
	});

	it('uses lowercase-kebab-case for every directory and entry name', () => {
		const offenders = entries.filter(p => {
			const segments = p.split(sep);
			const stem = segments.pop().replace(ENTRY_RE, '');
			return ![...segments, stem].every(s => SLUG_RE.test(s));
		});
		assert.deepEqual(offenders, [], `Rename to lowercase-kebab-case: ${offenders.join(', ')}`);
	});
});
