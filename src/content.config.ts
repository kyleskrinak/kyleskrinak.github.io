import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const BLOG_PATH = 'src/content/blog';

// Absolute external link fields that feed href attributes: must parse as a
// URL AND carry http(s) — z.string().url() alone accepts any parseable
// scheme, javascript: included. Requiring a scheme is correct for these
// always-absolute fields; the blocklist-over-allowlist rule applies to
// fields that may hold relative URLs, which these never do. The protocol
// check runs on the parsed URL, so scheme casing (HTTPS://) is handled per
// RFC 3986; .url() has already guaranteed new URL() won't throw.
const httpUrl = z.string().trim().url().refine(
	(v) => ['http:', 'https:'].includes(new URL(v).protocol),
	{ message: 'Must be an absolute http(s) URL' },
);

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
		// Email/URL fields feed hrefs (mailto:, links) on both resume routes
		// and the PDF — validate shape at build time (Copilot review, PR #242)
		contactEmail: z.string().trim().email().optional(),
		contactWebsite: httpUrl.optional(),
		contactLinkedin: httpUrl.optional(),
		contactAddress: z.string().trim().min(1).optional(),
		current_role: z.object({
			title: z.string().trim().min(1),
			employer: z.string().trim().min(1),
			start_date: z.coerce.date(),
		}).optional(),
		skills_inventory: z.object({
			last_reviewed: z.coerce.date(),
			categories: z.array(z.object({
				name: z.string().trim().min(1),
				id: z.string().trim().regex(/^[a-z0-9-]+$/),
				skills: z.array(z.string().trim().min(1)).min(1),
			})),
		}).optional(),
		certifications: z.object({
			items: z.array(z.object({
				name: z.string().trim().min(1),
				issuer: z.string().trim().min(1).optional(),
				issued: z.coerce.date().optional(),
				expires: z.coerce.date().optional(),
				render: z.boolean().default(true),
			})),
		}).optional(),
		education: z.object({
			items: z.array(z.object({
				degree: z.string().trim().min(1),
				institution: z.string().trim().min(1),
				location: z.string().trim().min(1).optional(),
				years: z.string().trim().min(1).optional(),
				honors: z.string().trim().min(1).optional(),
				render: z.boolean().default(false),
			})),
		}).optional(),
		changelog: z.array(z.object({
			date: z.coerce.date(),
			entry: z.string().trim().min(1),
		})).optional(),
	}),
});

export const collections = {
	blog,
	pages,
};
