import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * Single entry point for reading the blog collection.
 *
 * Filters out drafts (frontmatter `published: false`) in production builds.
 * Dev keeps drafts visible so authors can preview unfinished posts.
 */
export async function getBlogPosts(): Promise<CollectionEntry<'blog'>[]> {
	const showDrafts = !import.meta.env.PROD;
	return getCollection('blog', ({ data }) => showDrafts || data.published !== false);
}
