import { visit } from 'unist-util-visit';

/**
 * Rehype plugin to enhance images with lazy loading and optimization
 * Adds loading="lazy" and decoding="async" to all img tags
 */
export function rehypeImageOptimization() {
	return function transformer(tree) {
		visit(tree, 'element', (node) => {
			if (node.tagName === 'img') {
				// Add lazy loading if not already present
				if (!node.properties?.loading) {
					node.properties = node.properties || {};
					node.properties.loading = 'lazy';
				}
				// Add async decoding
				if (!node.properties?.decoding) {
					node.properties = node.properties || {};
					node.properties.decoding = 'async';
				}
			}
		});
	};
}

export function rehypeComponents() {
	return function transformer(tree) {
		visit(tree, 'text', (node, index, parent) => {
			if (!node.value) return;

			// Handle <Figure ... />
			const figureMatch = node.value.match(
				/<Figure\s+image_path="([^"]*)"\s+alt="([^"]*)"\s+(?:caption="([^"]*)")?\s*\/>/
			);
			if (figureMatch) {
				const [fullMatch, imagePath, alt, caption] = figureMatch;
				const figure: Element = {
					type: 'element',
					tagName: 'figure',
					properties: { className: ['figure'] },
					children: [
						{
							type: 'element',
							tagName: 'img',
							properties: {
								src: imagePath,
								alt: alt,
								className: ['figure__image'],
							},
							children: [],
						},
					],
				};

				if (caption) {
					figure.children?.push({
						type: 'element',
						tagName: 'figcaption',
						properties: { className: ['figure__caption'] },
						children: [{ type: 'html', value: caption }],
					});
				}

				if (parent && index !== undefined) {
					parent.children[index] = figure;
				}
			}

			// Handle <FbMigrate ... />
			const fbMatch = node.value.match(
				/<FbMigrate\s+fb_url="([^"]*)"\s+original_date="([^"]*)"\s*\/>/
			);
			if (fbMatch) {
				const [fullMatch, fbUrl, originalDate] = fbMatch;
				const notice: Element = {
					type: 'element',
					tagName: 'div',
					properties: { className: ['notice', 'notice--info'] },
					children: [
						{
							type: 'element',
							tagName: 'em',
							properties: {},
							children: [
								{
									type: 'element',
									tagName: 'strong',
									properties: {},
									children: [{ type: 'text', value: 'Note:' }],
								},
								{
									type: 'text',
									value: '\n    I originally posted this on my Facebook account on\n    ',
								},
								{
									type: 'element',
									tagName: 'a',
									properties: { href: fbUrl },
									children: [{ type: 'text', value: originalDate }],
								},
								{
									type: 'text',
									value: '. However, Facebook is getting rid of\n    their "notes" blog-like ability, so I\'ve moved this content to my blog, with\n    some edits for clarity.',
								},
							],
						},
					],
				};

				if (parent && index !== undefined) {
					parent.children[index] = notice;
				}
			}
		});
	};
}
