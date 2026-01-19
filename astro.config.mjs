// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Determine environment: production (main branch) or staging (staging branch)
const buildEnv = process.env.BUILD_ENV || 'production';
const isProduction = buildEnv === 'production';
const site = isProduction ? 'https://kyle.skrinak.com' : 'https://kyleskrinak.github.io';
const base = isProduction ? '/' : '/astro-blog/';

// Debug logging
console.log('🔍 Build Configuration:');
console.log(`   BUILD_ENV: "${process.env.BUILD_ENV}" (detected) → buildEnv: "${buildEnv}"`);
console.log(`   isProduction: ${isProduction}`);
console.log(`   site: ${site}`);
console.log(`   base: ${base}`);

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
