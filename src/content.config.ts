import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const BLOG_PATH = 'src/content/blog';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) => z.object({
		title: z.string(),
		description: z.string().optional(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		author: z.string().optional(),
		image: image().optional(),
		heroImage: image().optional(),
		ogImage: image().optional(),
		alt: z.string().trim().min(1).optional(),
		caption: z.string().trim().min(1).optional(),
		imagePosition: z.enum([
			'top', 'right top', 'right', 'right bottom', 'bottom',
			'left bottom', 'left', 'left top', 'center', 'centre',
			'north', 'northeast', 'east', 'southeast', 'south',
			'southwest', 'west', 'northwest', 'entropy', 'attention',
		]).optional(),
		canonicalURL: z.string().optional(),
		tags: z.array(z.string()).optional(),
		categories: z.array(z.string()).optional(),
		featured: z.boolean().optional(),
		published: z.boolean().optional(),
		hideEditPost: z.boolean().optional(),
		toc: z.boolean().optional(),
		source: z.enum(['jekyll', 'astro']).optional(),
	}).superRefine((data, ctx) => {
		// Enforce: if an on-page image field exists, alt text is required for accessibility
		const hasOnPageImage = data.image || data.heroImage;
		if (hasOnPageImage && !data.alt) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Alt text is required when an on-page image (image or heroImage) is provided',
				path: ['alt'],
			});
		}
	}),
});

const pages = defineCollection({
	loader: glob({ base: './src/content/pages', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) => z.object({
		title: z.string(),
		description: z.string().optional(),
		author: z.string().optional(),
		pubDate: z.coerce.date().optional(),
		permalink: z.string().optional(),
		toc: z.boolean().optional(),
		image: image().optional(),
		alt: z.string().trim().min(1).optional(),
	}),
});

export const collections = {
	blog,
	pages,
};
