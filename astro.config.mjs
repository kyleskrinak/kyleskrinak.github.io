// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Determine environment: production (main branch) or staging (staging branch)
const isProduction = process.env.GITHUB_REF === 'refs/heads/main';
const site = isProduction ? 'https://kyle.skrinak.com' : 'https://kyleskrinak.github.io';
const base = isProduction ? '/' : '/astro-blog/';

// https://astro.build/config
export default defineConfig({
	site,
	base,
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
