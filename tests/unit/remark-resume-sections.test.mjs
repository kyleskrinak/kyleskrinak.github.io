import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
	// inside a fence, and one indented 4 spaces (both code, both inert).
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
	].join('\n');

	it('selects the same placeholders on the markdown path and the page path', () => {
		assert.deepEqual(
			treeHeadings(runPlugin(body)),
			markdownHeadings(expandResumePlaceholders(body, data)),
		);
	});

	it('expands the two top-level placeholders and leaves both code blocks alone', () => {
		assert.deepEqual(treeHeadings(runPlugin(body)), [
			'Senior IT Systems Engineering Manager, Digital Experience',
			'M.S. I.T.',
		]);
	});

	it('leaves the fenced and indented placeholders in the expanded markdown verbatim', () => {
		const expanded = expandResumePlaceholders(body, data);
		assert.ok(expanded.includes('```markdown\n<!-- education -->\n```'));
		assert.ok(expanded.includes('\n    <!-- education -->'));
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
