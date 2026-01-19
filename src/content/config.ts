import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		author: z.string().optional(),
		image: z.string().optional(),
		alt: z.string().optional(),
		tags: z.array(z.string()).optional(),
		categories: z.array(z.string()).optional(),
		featured: z.boolean().optional(),
		published: z.boolean().optional(),
		hidden: z.boolean().optional(),
		toc: z.boolean().optional(),
		source: z.enum(['jekyll', 'astro']).optional(),
	}),
});

const pages = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		author: z.string().optional(),
		pubDate: z.coerce.date().optional(),
		permalink: z.string().optional(),
		toc: z.boolean().optional(),
	}),
});

const presentations = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		date: z.coerce.date(),
		author: z.string().optional(),
		theme: z.enum(['default', 'reveal-duke']).optional(),
		tags: z.array(z.string()).optional(),
	}),
});

export const collections = {
	blog,
	pages,
	presentations,
};
