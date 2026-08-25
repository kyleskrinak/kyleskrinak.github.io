import { test, expect } from '@playwright/test';
import { BASE_URL } from '../test-utils';

// Mirrors the URL handling in seo-meta-tags.spec.ts: BASE_URL may carry a base path
// (e.g. https://example.com/site/), and URL.pathname reports '/' when it carries none.
const basePathname = (() => {
	const rawPathname = new URL(BASE_URL).pathname;
	if (rawPathname === '/') return '';
	return rawPathname.endsWith('/') ? rawPathname.slice(0, -1) : rawPathname;
})();

const resolveUrl = (path: string) => {
	const effectivePath = path.startsWith('/') ? path : `/${path}`;
	const fullPath = basePathname !== '' ? `${basePathname}${effectivePath}` : effectivePath;
	return new URL(fullPath, BASE_URL).toString();
};

const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);

/**
 * The h-entry markup in PostDetails.astro is the machine-readable representation of
 * every post: what a webmention receiver, a reader, or an aggregator parses when it
 * pulls this site's content. Nothing else in the suite covers it. A dropped or
 * misplaced class passes lint, `astro check`, the build, the link check, and all 42
 * visual baselines in silence -- pixels are identical whether or not `e-content` is
 * on the article. These assertions pin the microformat contract itself, the way
 * h-card.spec.ts does for the footer card.
 *
 * No microformats parser is installed in this project, so the properties are
 * asserted through DOM selectors rather than by parsing the document.
 */

/**
 * Three real posts stand in for three markup shapes. Changing their frontmatter
 * changes what this file proves:
 *
 *   POST_HERO_AND_TAGS  has `image` and `tags`      -> u-featured, p-category
 *   POST_PLAIN          has none of image/tags/     -> the only clean negative for
 *                       updatedDate                    all three absence cases
 *   POST_REVISED        has updatedDate (2026-07-16) -> dt-updated
 *                       after pubDate (2019-09-14)
 *
 * POST_REVISED also carries an `image`, so it is not a u-featured negative.
 * Adding `tags:`, `image:`, or `updatedDate:` to POST_PLAIN turns three passing
 * negative assertions into failures on a change that is not a regression.
 */
const POST_HERO_AND_TAGS = '/posts/2026-07-19-funmaxxing/';
const POST_PLAIN = '/posts/2021-01-16-jekyll-hugo-and-me/';
const POST_REVISED = '/posts/2019-09-14-my-windows-10-setup/';

test.describe('Post h-entry', () => {
	test('a post page is exactly one h-entry, rooted on main', async ({ page }) => {
		await page.goto(resolveUrl(POST_HERO_AND_TAGS), { waitUntil: 'networkidle' });

		await expect(page.locator('.h-entry')).toHaveCount(1);
		await expect(page.locator('main.h-entry')).toHaveCount(1);

		// A nested h-entry would re-root every property below it onto the inner entry,
		// silently emptying the outer one. <Webmentions /> renders *inside* main.h-entry
		// and emits no microformats classes today; the day it renders mentions as
		// h-cite/h-card, this assertion starts failing from remote data, not from a
		// layout change. That is where to look first.
		await expect(page.locator('.h-entry .h-entry')).toHaveCount(0);
	});

	test('p-name carries the post title', async ({ page }) => {
		await page.goto(resolveUrl(POST_HERO_AND_TAGS), { waitUntil: 'networkidle' });

		// Scoped to the h1 inside the entry on purpose: `.p-name` also matches the
		// author anchor in the hidden identity block (and, on the homepage, the
		// footer h-card), so a bare `.p-name` count would assert the wrong thing.
		const name = page.locator('.h-entry h1.p-name');
		await expect(name).toHaveCount(1);

		const nameText = ((await name.textContent()) ?? '').trim();
		expect(nameText.length).toBeGreaterThan(0);
		// The document title is built from the same frontmatter, so a p-name that has
		// drifted off the heading shows up as a mismatch here.
		expect(await page.title()).toContain(nameText);
	});

	test('e-content is the article body', async ({ page }) => {
		await page.goto(resolveUrl(POST_HERO_AND_TAGS), { waitUntil: 'networkidle' });

		const content = page.locator('.e-content');
		await expect(content).toHaveCount(1);
		// Anchored to the article element: e-content landing on a wrapper would hand
		// consumers the surrounding chrome (tags, share links, webmentions) as the post.
		await expect(page.locator('article#article.e-content')).toHaveCount(1);
	});

	test('dt-published exposes a parseable datetime', async ({ page }) => {
		await page.goto(resolveUrl(POST_HERO_AND_TAGS), { waitUntil: 'networkidle' });

		const published = page.locator('.h-entry time.dt-published');
		await expect(published).toHaveCount(1);

		const datetime = await published.getAttribute('datetime');
		expect(datetime).toBeTruthy();
		// ISO-8601, not a localized display string: a consumer reads the attribute,
		// never the rendered text.
		expect(datetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(Number.isNaN(Date.parse(datetime as string))).toBe(false);
	});

	test('dt-updated appears on a revised post, after its publish date', async ({ page }) => {
		await page.goto(resolveUrl(POST_REVISED), { waitUntil: 'networkidle' });

		const updated = page.locator('.h-entry time.dt-updated');
		await expect(updated).toHaveCount(1);

		const publishedAt = Date.parse(
			(await page.locator('.h-entry time.dt-published').getAttribute('datetime')) as string
		);
		const updatedAt = Date.parse((await updated.getAttribute('datetime')) as string);
		// Swapped properties would still parse; ordering is what catches that.
		expect(updatedAt).toBeGreaterThan(publishedAt);
	});

	test('dt-updated is absent on a post that was never revised', async ({ page }) => {
		await page.goto(resolveUrl(POST_PLAIN), { waitUntil: 'networkidle' });
		// An always-rendered dt-updated would claim every post was revised today.
		await expect(page.locator('.dt-updated')).toHaveCount(0);
	});

	test('p-author h-card resolves to a name, a URL, and a photo', async ({ page }) => {
		await page.goto(resolveUrl(POST_HERO_AND_TAGS), { waitUntil: 'networkidle' });

		// `.p-author.h-card` is the one identity selector that is unique on a post page.
		const author = page.locator('.p-author.h-card');
		await expect(author).toHaveCount(1);

		const nameUrl = author.locator('a.p-name.u-url');
		await expect(nameUrl).toHaveCount(1);

		// The identity block is `hidden` -- parsers read the DOM and ignore that, but
		// toBeVisible() would fail on correct markup. Read values instead.
		const authorName = ((await nameUrl.textContent()) ?? '').trim();
		expect(authorName.length).toBeGreaterThan(0);

		const authorUrl = await nameUrl.evaluate((el) => (el as HTMLAnchorElement).href);
		expect(authorUrl).toMatch(/^https?:\/\//);

		const photo = author.locator('img.u-photo');
		await expect(photo).toHaveCount(1);
		// Width/height are required for CLS; a hidden image is no exception, because
		// nothing guarantees it stays hidden.
		await expect(photo).toHaveAttribute('width', /\d+/);
		await expect(photo).toHaveAttribute('height', /\d+/);
	});

	test('the entry u-url points at this post', async ({ page }) => {
		const target = resolveUrl(POST_HERO_AND_TAGS);
		await page.goto(target, { waitUntil: 'networkidle' });

		// The entry's own u-url is the anchor that is *not* the author's: `.u-url`
		// matches both the entry link and the author link inside p-author.
		const entryUrl = page.locator('.h-entry a.u-url:not(.p-name)');
		await expect(entryUrl).toHaveCount(1);

		const href = await entryUrl.evaluate((el) => (el as HTMLAnchorElement).href);
		// Path equality always holds: postUrl is built from Astro.site, so only the
		// origin can differ between the production, staging, and local base URLs.
		expect(withSlash(new URL(href).pathname)).toBe(withSlash(new URL(page.url()).pathname));

		const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
		expect(canonical).toBeTruthy();

		// Full-URL equality only where the canonical still names this page's own path.
		// postUrl deliberately ignores a frontmatter canonicalURL override (see the
		// comment in PostDetails.astro), so an unconditional comparison would fire on
		// the first post that points its canonical at an external original. No post
		// overrides it today, so this branch always runs.
		const canonicalPath = new URL(canonical as string, page.url()).pathname;
		if (withSlash(canonicalPath) === withSlash(new URL(page.url()).pathname)) {
			expect(withSlash(href)).toBe(withSlash(new URL(canonical as string, page.url()).toString()));
		}
	});

	test('p-category carries each tag name and links to its tag page', async ({ page }) => {
		await page.goto(resolveUrl(POST_HERO_AND_TAGS), { waitUntil: 'networkidle' });

		const categories = page.locator('.h-entry a.p-category');
		const count = await categories.count();
		expect(count).toBeGreaterThan(0);

		for (let i = 0; i < count; i++) {
			const category = categories.nth(i);
			// Each anchor opens with an inline IconHash SVG, so the text content arrives
			// padded -- trim, and never compare strictly.
			const value = ((await category.textContent()) ?? '').trim();
			expect(value.length).toBeGreaterThan(0);
			// A newline inside the value means the class slid onto a wrapper and swept
			// up the surrounding markup's whitespace.
			expect(value).not.toContain('\n');

			const href = await category.evaluate((el) => (el as HTMLAnchorElement).href);
			expect(new URL(href).pathname).toMatch(/\/tags\/[^/]+\/$/);
		}
	});

	test('p-category is absent from an untagged post', async ({ page }) => {
		await page.goto(resolveUrl(POST_PLAIN), { waitUntil: 'networkidle' });
		// Page-global, as with .dt-updated and .u-featured below: an untagged post
		// must carry no p-category anywhere, not merely none inside the entry.
		await expect(page.locator('.p-category')).toHaveCount(0);
	});

	test('u-featured is the hero image, and sits outside e-content', async ({ page }) => {
		await page.goto(resolveUrl(POST_HERO_AND_TAGS), { waitUntil: 'networkidle' });

		const featured = page.locator('.h-entry img.u-featured');
		await expect(featured).toHaveCount(1);

		// Deliberate placement, per the layout comment: the representative image is
		// declared once inside the h-entry but outside the body, not duplicated into it.
		await expect(page.locator('.e-content .u-featured')).toHaveCount(0);
	});

	test('u-featured is absent from a post with no hero image', async ({ page }) => {
		await page.goto(resolveUrl(POST_PLAIN), { waitUntil: 'networkidle' });
		await expect(page.locator('.u-featured')).toHaveCount(0);
	});

	// Cards are summaries, not entries. Note these pages *do* carry .dt-published
	// (Card.astro renders Datetime) and .p-category (Tag.astro is reused there), so
	// only the h-entry root can be asserted here -- with no microformat root above
	// them, a parser ignores those properties.
	//
	// The loop generates one test per page; it does not run both pages inside one
	// test. That matters: a single test asserting both would throw on the first
	// failing page and never reach the second, so a run would report half the
	// breakage.
	for (const path of ['/tags/', '/archives/']) {
		test(`${path} exposes no h-entry`, async ({ page }) => {
			await page.goto(resolveUrl(path), { waitUntil: 'networkidle' });
			await expect(page.locator('.h-entry')).toHaveCount(0);
		});
	}
});
