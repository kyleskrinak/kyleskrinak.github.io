import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { remarkResumeSections } from '../../src/lib/remark-resume-sections.mjs';
import { expandResumePlaceholders } from '../../src/lib/resume-sections.mjs';

// Absolute, the way Astro hands it over; the plugin matches on the suffix.
const RESUME_PATH = '/repo/src/content/pages/resume/index.md';
const BLOG_PATH = '/repo/src/content/blog/2026-01-01-a-post/index.md';

const currentRole = {
	title: 'Senior IT Systems Engineering Manager, Digital Experience',
	employer: 'Gilead Sciences',
	location: 'Raleigh, NC',
	start_date: '2022-06-01',
};

const education = {
	items: [
		{
			degree: 'Master of Science, Information Technology',
			degree_abbr: 'M.S. I.T.',
			institution: 'Rochester Institute of Technology',
			location: 'Rochester, NY',
			years: '1998 – 2001',
			render: true,
		},
	],
};

const data = { current_role: currentRole, education };

function runPlugin(body, { path = RESUME_PATH, frontmatter = data } = {}) {
	const tree = fromMarkdown(body);
	const file = {
		path,
		data: { astro: { frontmatter } },
		fail(message) {
			throw new Error(message);
		},
	};
	remarkResumeSections()(tree, file);
	return tree;
}

function treeHeadings(tree) {
	return tree.children
		.filter(node => node.type === 'heading' && node.depth === 2)
		.map(node => node.children.map(child => child.value ?? '').join(''));
}

function markdownHeadings(markdown) {
	return [...markdown.matchAll(/^## (.+)$/gm)].map(match => match[1]);
}

describe('expansion parity between the two paths', () => {
	// One body exercising every position CommonMark distinguishes: a plain
	// top-level placeholder, one indented 3 spaces (still an HTML block), one
	// inside a fence, one indented 4 spaces, three reaching column four through a
	// tab — bare, after one space, and after three — and one split across lines.
	// A tab advances to the next multiple of four columns, so all three are code,
	// like the four spaces above them. The multiline comment is one HTML block to
	// mdast and three unrecognizable lines to the string path, so it is inert on
	// both only because classifyPlaceholder rejects embedded line breaks. Every
	// placeholder above is inert. The last pair is not: a comment carrying three
	// backticks is one HTML block to mdast, so the placeholder after it expands —
	// and the string path only agrees because it consumes the comment whole
	// instead of reading a fence inside it.
	const body = [
		'<!-- current-role -->',
		'',
		'Lead a team.',
		'',
		'   <!-- education -->',
		'',
		'```markdown',
		'<!-- education -->',
		'```',
		'',
		'    <!-- education -->',
		'',
		'\t<!-- education -->',
		'',
		' \t<!-- education -->',
		'',
		'   \t<!-- education -->',
		'',
		'<!--',
		'education',
		'-->',
		'',
		'<!-- TODO',
		'```',
		'-->',
		'',
		'<!-- education -->',
		'',
	].join('\n');

	it('selects the same placeholders on the markdown path and the page path', () => {
		assert.deepEqual(
			treeHeadings(runPlugin(body)),
			markdownHeadings(expandResumePlaceholders(body, data)),
		);
	});

	it('expands the three top-level placeholders and leaves both code blocks alone', () => {
		assert.deepEqual(treeHeadings(runPlugin(body)), [
			'Senior IT Systems Engineering Manager, Digital Experience',
			'M.S. I.T.',
			// The one after the comment that carries a fence.
			'M.S. I.T.',
		]);
	});

	it('leaves the fenced and indented placeholders in the expanded markdown verbatim', () => {
		const expanded = expandResumePlaceholders(body, data);
		assert.ok(expanded.includes('```markdown\n<!-- education -->\n```'));
		assert.ok(expanded.includes('\n    <!-- education -->'));
		for (const indent of ['\t', ' \t', '   \t']) {
			assert.ok(
				expanded.includes(`\n${indent}<!-- education -->`),
				`tab-indented placeholder "${JSON.stringify(indent)}" should survive verbatim`,
			);
		}
		assert.ok(expanded.includes('\n<!--\neducation\n-->'));
	});

	it('leaves a multiline placeholder inert on the page path too', () => {
		// mdast hands the plugin the whole comment as one html node, so without the
		// line-break guard this one expands into headings the string path cannot
		// produce — the string path splits on newlines and sees `<!--`,
		// `education` and `-->`, none of which is placeholder-shaped.
		const tree = runPlugin('<!--\neducation\n-->');
		assert.deepEqual(treeHeadings(tree), []);
		assert.equal(tree.children.length, 1);
		assert.equal(tree.children[0].type, 'html');
		assert.equal(tree.children[0].value, '<!--\neducation\n-->');
	});

	it('reads a fence inside an HTML comment as comment text on both paths', () => {
		// A comment is one HTML block in CommonMark, and nothing inside it opens
		// anything else. Reading those three backticks as a fence left the string
		// path inside a code block that never closed, so every later placeholder
		// looked like sample text while the page expanded it — education missing
		// from the PDF expectations and its variant anchors unknown.
		const body = '<!-- TODO\n```\n-->\n\n<!-- education -->';
		assert.deepEqual(treeHeadings(runPlugin(body)), ['M.S. I.T.']);
		assert.deepEqual(
			markdownHeadings(expandResumePlaceholders(body, data)),
			['M.S. I.T.'],
		);
	});

	it('keeps a real fence opaque and an unclosed comment open, on both paths', () => {
		// The two sides of the same boundary: a fence outside a comment still hides
		// a placeholder, and a comment with no closing delimiter runs to the end of
		// the body — which is how remark reads it too.
		for (const body of [
			'```\n<!-- education -->\n```',
			'<!-- TODO\n\n<!-- education -->',
			'<!-- TODO -->\n\n```\n<!-- education -->\n```',
		]) {
			assert.deepEqual(treeHeadings(runPlugin(body)), [], body);
			assert.deepEqual(markdownHeadings(expandResumePlaceholders(body, data)), [], body);
		}
	});

	it('drops the placeholder on both paths when a section expands to empty', () => {
		const optedOut = { ...data, education: { items: [{ ...education.items[0], render: false }] } };
		assert.deepEqual(treeHeadings(runPlugin('before\n\n<!-- education -->\n\nafter', { frontmatter: optedOut })), []);
		// The placeholder line goes; its surrounding blank lines stay, which is why
		// the two of them meet here.
		assert.equal(
			expandResumePlaceholders('before\n\n<!-- education -->\n\nafter', optedOut),
			'before\n\n\nafter',
		);
	});
});

describe('the unknown-placeholder guard', () => {
	it('fails the build for a placeholder-shaped typo in the resume source', () => {
		assert.throws(
			() => runPlugin('<!-- educaton -->'),
			/unknown section placeholder "<!-- educaton -->"/,
		);
	});

	it('names the plugin and the file so the build points at the source', () => {
		assert.throws(() => runPlugin('<!-- educaton -->'), /\[remark-resume-sections\]/);
		assert.throws(() => runPlugin('<!-- educaton -->'), /content\/pages\/resume\/index\.md/);
	});

	it('leaves the same shape inert in any other document', () => {
		// `<!-- more -->` is an ordinary comment in a post; only the resume owns
		// this shape, so the guard must not reach outside it.
		const tree = runPlugin('<!-- more -->', { path: BLOG_PATH });
		assert.equal(tree.children[0].value, '<!-- more -->');
	});

	it('leaves a known section name inert in any other document too', () => {
		// Scope covers expansion, not just the typo guard. A post's frontmatter
		// carries no `education`, so expanding here would fail the build on a page
		// that never asked for a resume section.
		const tree = runPlugin('intro\n\n<!-- education -->', {
			path: BLOG_PATH,
			frontmatter: { title: 'A post' },
		});
		assert.deepEqual(treeHeadings(tree), []);
		assert.equal(tree.children.at(-1).value, '<!-- education -->');
	});

	it('does not fire for a multiline placeholder-shaped typo', () => {
		// `\s*` in the shaped regex matches a newline, so this throws on the page
		// path and passes silently on the string path unless the line-break guard
		// rejects it first. Inert on both is the agreement; the typo guard only
		// ever covered the single-line form the convention actually uses.
		const body = '<!--\neducaton\n-->';
		assert.deepEqual(treeHeadings(runPlugin(body)), []);
		assert.equal(expandResumePlaceholders(body, data), body);
	});

	it('leaves a prose comment inert in the resume itself', () => {
		const tree = runPlugin('<!-- TODO revisit -->');
		assert.equal(tree.children[0].value, '<!-- TODO revisit -->');
	});

	it('reports a missing frontmatter section through the same wrapped error', () => {
		assert.throws(
			() => runPlugin('<!-- current-role -->', { frontmatter: {} }),
			/\[remark-resume-sections\].*`current_role` is missing/s,
		);
	});
});

describe('the matcher and the resume file on disk', () => {
	// Every other scoping test hardcodes RESUME_PATH, so they pin the matcher's
	// logic and say nothing about the file Astro actually hands it. These two read
	// the resume's real location: move the file or drift the suffix constant and
	// they fail here, at unit-test speed, instead of shipping a page whose
	// placeholders silently never expanded.
	const REAL_RESUME = fileURLToPath(
		new URL('../../src/content/pages/resume/index.md', import.meta.url),
	);

	it('finds the resume source where the plugin expects it', () => {
		assert.ok(existsSync(REAL_RESUME), `${REAL_RESUME} does not exist`);
	});

	it('expands for that file at its real absolute path', () => {
		assert.deepEqual(treeHeadings(runPlugin('<!-- education -->', { path: REAL_RESUME })), [
			'M.S. I.T.',
		]);
	});
});

describe('placeholder position contract', () => {
	// The contract is a TOP-LEVEL placeholder: the page path walks top-level nodes
	// only, so a placeholder nested inside a list item is not a placeholder there.
	// Nothing in the resume nests one, and this test records which path is
	// authoritative if one ever does.
	it('ignores a placeholder nested inside a list item on the page path', () => {
		const tree = runPlugin('- item\n\n  <!-- education -->');
		assert.deepEqual(treeHeadings(tree), []);
	});
});
