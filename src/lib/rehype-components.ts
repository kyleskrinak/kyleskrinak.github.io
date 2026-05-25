import { visit } from 'unist-util-visit';
import type { Root } from 'hast';

/**
 * Rehype plugin to enhance images with lazy loading and optimization
 * Adds loading="lazy" and decoding="async" to all img tags
 */
export function rehypeImageOptimization() {
	return function transformer(tree: Root) {
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

