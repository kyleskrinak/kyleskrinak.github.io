import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	const posts = await getCollection('blog');
	const sortedPosts = posts.sort((a, b) =>
		new Date(b.data.pubDate).valueOf() - new Date(a.data.pubDate).valueOf()
	);

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: sortedPosts.map((post) => ({
			title: post.data.title,
			pubDate: post.data.pubDate,
			description: post.data.description,
			categories: post.data.categories || [],
			link: `/blog/${post.id}/`,
		})),
		trailingSlash: false,
	});
}
