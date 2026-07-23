import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { remarkCards } from '../../src/lib/remark-cards.mjs';

function text(value) {
	return { type: 'text', value };
}

function paragraph(...children) {
	return { type: 'paragraph', children };
}

function imageParagraph(url, alt) {
	return paragraph({ type: 'image', url, alt });
}

function emphasisParagraph(value) {
	return paragraph({ type: 'emphasis', children: [text(value)] });
}

function heading(depth, value) {
	return { type: 'heading', depth, children: [text(value)] };
}

function thematicBreak() {
	return { type: 'thematicBreak' };
}

// remark-directive output shape for `:::cards{.variant}` blocks.
function cardsDirective(attributes, children) {
	return { type: 'containerDirective', name: 'cards', attributes, children };
}

function runPlugin(tree) {
	remarkCards()(tree);
	return tree;
}

describe('remarkCards', () => {
	it('maps the container to div.card-row with the class attribute as variant', () => {
		const directive = cardsDirective({ class: 'testimonials' }, [paragraph(text('one'))]);
		runPlugin({ type: 'root', children: [directive] });

		assert.equal(directive.data.hName, 'div');
		assert.deepEqual(directive.data.hProperties.className, ['card-row', 'testimonials']);
	});

	it('renders bare :::cards as plain card-row', () => {
		for (const attributes of [undefined, {}]) {
			const directive = cardsDirective(attributes, [paragraph(text('one'))]);
			runPlugin({ type: 'root', children: [directive] });

			assert.deepEqual(directive.data.hProperties.className, ['card-row']);
		}
	});

	it('splits children into cards on thematic breaks and drops the breaks', () => {
		const directive = cardsDirective({}, [
			paragraph(text('one')),
			thematicBreak(),
			paragraph(text('two')),
			thematicBreak(),
			paragraph(text('three')),
		]);
		runPlugin({ type: 'root', children: [directive] });

		assert.equal(directive.children.length, 3);
		for (const card of directive.children) {
			assert.deepEqual(card.data.hProperties.className, ['card']);
			assert.ok(card.children.every(c => c.type !== 'thematicBreak'));
		}
	});

	it('hoists a leading image paragraph as direct card-media child and wraps in figure', () => {
		const directive = cardsDirective({}, [
			imageParagraph('/images/x.jpg', 'alt text'),
			paragraph(text('body')),
		]);
		runPlugin({ type: 'root', children: [directive] });

		const card = directive.children[0];
		assert.equal(card.data.hName, 'figure');
		assert.equal(card.children[0].type, 'image');
		assert.deepEqual(card.children[0].data.hProperties.className, ['card-media']);
	});

	it('turns a trailing lone-emphasis paragraph into a figcaption and wraps in figure', () => {
		const directive = cardsDirective({}, [
			paragraph(text('body')),
			emphasisParagraph('Artist, Title, 1659'),
		]);
		runPlugin({ type: 'root', children: [directive] });

		const card = directive.children[0];
		assert.equal(card.data.hName, 'figure');
		const footer = card.children.at(-1);
		assert.equal(footer.data.hName, 'figcaption');
		assert.deepEqual(footer.data.hProperties.className, ['card-footer']);
	});

	it('keeps heading-and-paragraph cards as div and retypes ### as h3.card-title', () => {
		const h3 = heading(3, 'Creatine');
		const directive = cardsDirective({}, [h3, paragraph(text('body'))]);
		runPlugin({ type: 'root', children: [directive] });

		const card = directive.children[0];
		assert.equal(card.data.hName, 'div');
		assert.equal(h3.type, 'paragraph'); // invisible to remark-toc, which runs later
		assert.equal(h3.depth, undefined);
		assert.equal(h3.data.hName, 'h3');
		assert.deepEqual(h3.data.hProperties.className, ['card-title']);
	});

	it('leaves headings of other depths alone', () => {
		const h4 = heading(4, 'Sub-detail');
		const directive = cardsDirective({}, [h4, paragraph(text('body'))]);
		runPlugin({ type: 'root', children: [directive] });

		assert.equal(h4.type, 'heading');
		assert.equal(h4.depth, 4);
		assert.equal(h4.data, undefined);
	});

	it('does not treat a card that is only one emphasized paragraph as a footer', () => {
		const only = emphasisParagraph('just an aside');
		const directive = cardsDirective({}, [only]);
		runPlugin({ type: 'root', children: [directive] });

		const card = directive.children[0];
		assert.equal(card.data.hName, 'div');
		assert.equal(only.data, undefined);
	});

	it('handles the full testimonial shape: image + blockquote + emphasis footer', () => {
		const blockquote = { type: 'blockquote', children: [paragraph(text('Great product!'))] };
		const directive = cardsDirective({ class: 'testimonials' }, [
			imageParagraph('/images/portrait.webp', 'Portrait of a person'),
			blockquote,
			emphasisParagraph('Artist, Title, 1659'),
		]);
		runPlugin({ type: 'root', children: [directive] });

		const card = directive.children[0];
		assert.equal(card.data.hName, 'figure');
		assert.equal(card.children[0].type, 'image');
		assert.deepEqual(card.children[0].data.hProperties.className, ['card-media']);
		assert.equal(card.children[1].type, 'blockquote');
		const footer = card.children.at(-1);
		assert.equal(footer.data.hName, 'figcaption');
		assert.deepEqual(footer.data.hProperties.className, ['card-footer']);
	});

	it('renders image-only card as figure without figcaption', () => {
		const directive = cardsDirective({}, [imageParagraph('/x.webp', 'Portrait alt text')]);
		runPlugin({ type: 'root', children: [directive] });

		const card = directive.children[0];
		assert.equal(card.data.hName, 'figure');
		assert.ok(card.children.every(c => c.data?.hName !== 'figcaption'));
	});

	it('leaves container directives with other names untouched', () => {
		const other = { type: 'containerDirective', name: 'note', attributes: {}, children: [paragraph(text('x'))] };
		runPlugin({ type: 'root', children: [other] });

		assert.equal(other.data, undefined);
		assert.equal(other.children[0].type, 'paragraph');
	});

	it('produces no empty card for a trailing thematic break', () => {
		const directive = cardsDirective({}, [paragraph(text('one')), thematicBreak()]);
		runPlugin({ type: 'root', children: [directive] });

		assert.equal(directive.children.length, 1);
	});

	it('passes multi-class variants through', () => {
		const directive = cardsDirective({ class: 'testimonials wide' }, [paragraph(text('one'))]);
		runPlugin({ type: 'root', children: [directive] });

		assert.deepEqual(directive.data.hProperties.className, ['card-row', 'testimonials', 'wide']);
	});

	it('strips dangerous attributes (event handlers, style, arbitrary keys) from the directive', () => {
		const directive = cardsDirective(
			{
				onclick: 'alert(1)',
				onerror: 'alert(1)',
				style: 'background: url(javascript:alert(1))',
				href: 'javascript:alert(1)',
				src: 'x',
				foo: 'bar',
			},
			[paragraph(text('one'))]
		);
		runPlugin({ type: 'root', children: [directive] });

		const { hProperties } = directive.data;
		for (const dangerous of ['onclick', 'onerror', 'style', 'href', 'src', 'foo']) {
			assert.ok(!(dangerous in hProperties), `expected "${dangerous}" to be stripped`);
		}
	});

	it('passes id, data-*, and aria-* attributes through unchanged', () => {
		const directive = cardsDirective(
			{ id: 'featured', 'data-testid': 'cards-row', 'aria-label': 'Featured items' },
			[paragraph(text('one'))]
		);
		runPlugin({ type: 'root', children: [directive] });

		const { hProperties } = directive.data;
		assert.equal(hProperties.id, 'featured');
		assert.equal(hProperties['data-testid'], 'cards-row');
		assert.equal(hProperties['aria-label'], 'Featured items');
	});

	it('rejects unsafe id values to prevent DOM clobbering', () => {
		for (const unsafeId of ['body', 'location', 'documentElement', 'head', '1id', 'has space', '']) {
			const directive = cardsDirective({ id: unsafeId }, [paragraph(text('one'))]);
			runPlugin({ type: 'root', children: [directive] });

			const { hProperties } = directive.data;
			assert.ok(!('id' in hProperties), `expected id "${unsafeId}" to be stripped`);
		}
	});

	it('does not let a dangerous key named "class" override the variant/className handling', () => {
		const directive = cardsDirective({ class: 'wide', onmouseover: 'alert(1)' }, [paragraph(text('one'))]);
		runPlugin({ type: 'root', children: [directive] });

		const { hProperties } = directive.data;
		assert.ok(!('onmouseover' in hProperties));
		assert.deepEqual(hProperties.className, ['card-row', 'wide']);
	});
});
