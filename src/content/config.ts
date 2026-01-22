import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const BLOG_PATH = 'src/content/blog';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		author: z.string().optional(),
		image: z.string().optional(),
		heroImage: z.string().optional(),
		ogImage: z.string().optional(),
		alt: z.string().optional(),
		canonicalURL: z.string().optional(),
		tags: z.array(z.string()).optional(),
		categories: z.array(z.string()).optional(),
		featured: z.boolean().optional(),
		published: z.boolean().optional(),
		hidden: z.boolean().optional(),
		hideEditPost: z.boolean().optional(),
		toc: z.boolean().optional(),
		source: z.enum(['jekyll', 'astro']).optional(),
	}),
});

const pages = defineCollection({
	loader: glob({ base: './src/content/pages', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		author: z.string().optional(),
		pubDate: z.coerce.date().optional(),
		permalink: z.string().optional(),
		toc: z.boolean().optional(),
	}),
});

export const collections = {
	blog,
	pages,
};
