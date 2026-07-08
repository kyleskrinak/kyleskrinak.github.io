import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { remarkFacets } from '../../src/lib/remark-facets.mjs';

function html(value) {
	return { type: 'html', value };
}

function text(value) {
	return { type: 'text', value };
}

function listItemWithTrailingHtml(value) {
	return {
		type: 'listItem',
		children: [
			{
				type: 'paragraph',
				children: [text('Resume bullet '), html(value)],
			},
		],
	};
}

function runPlugin(tree) {
	const file = {
		path: 'resume.md',
		fail(message) {
			throw new Error(message);
		},
	};
	remarkFacets()(tree, file);
	return tree;
}

describe('remarkFacets', () => {
	it('adds data-facets for valid trailing facet comments', () => {
		const item = listItemWithTrailingHtml('<!-- f: leadership, platform-ops -->');
		const tree = { type: 'root', children: [{ type: 'list', children: [item] }] };

		runPlugin(tree);

		assert.equal(item.data.hProperties['data-facets'], 'leadership platform-ops');
		assert.equal(item.children[0].children.length, 1);
		assert.equal(item.children[0].children[0].value, 'Resume bullet');
	});

	it('preserves unrelated trailing HTML comments as inert content', () => {
		const item = listItemWithTrailingHtml('<!-- unrelated -->');
		const tree = { type: 'root', children: [{ type: 'list', children: [item] }] };

		runPlugin(tree);

		assert.equal(item.data, undefined);
		assert.equal(item.children[0].children.at(-1).value, '<!-- unrelated -->');
	});

	it('fails hard for unknown facet ids instead of leaving bullets untagged', () => {
		const item = listItemWithTrailingHtml('<!-- f: leadership, typo -->');
		const tree = { type: 'root', children: [{ type: 'list', children: [item] }] };

		assert.throws(
			() => runPlugin(tree),
			/unknown facet\(s\) typo/,
		);
	});

	it('fails hard for malformed facet comments instead of leaving bullets untagged', () => {
		const item = listItemWithTrailingHtml('<!-- f: platform_ops -->');
		const tree = { type: 'root', children: [{ type: 'list', children: [item] }] };

		assert.throws(
			() => runPlugin(tree),
			/malformed facet tag/,
		);
	});

	it('fails hard for empty facet tokens instead of filtering them out', () => {
		for (const value of [
			'<!-- f: -->',
			'<!-- f:    -->',
			'<!-- f: leadership, -->',
			'<!-- f: leadership,,security -->',
		]) {
			const item = listItemWithTrailingHtml(value);
			const tree = { type: 'root', children: [{ type: 'list', children: [item] }] };

			assert.throws(
				() => runPlugin(tree),
				/malformed facet tag/,
				value,
			);
		}
	});
});
