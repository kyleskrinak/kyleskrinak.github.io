// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://kyle.skrinak.com',
	output: 'static',
	integrations: [
		mdx({
			jsxImportSource: 'astro/jsx',
			getHeadings: false,
		}),
		sitemap(),
	],
	env: {
		validateSecrets: true,
	},
});
