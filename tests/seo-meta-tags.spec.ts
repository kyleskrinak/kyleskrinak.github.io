import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4321';
const isStaging = BASE_URL.includes('github.io');

const resolveUrl = (path: string) => {
	const basePathname = new URL(BASE_URL).pathname;
	const effectivePath = path.startsWith('/') ? path : `/${path}`;
	const fullPath = basePathname !== '/' ? `${basePathname}${effectivePath}` : effectivePath;
	return new URL(fullPath, BASE_URL).toString();
};

const getRobotsMetaTag = async (page: import('@playwright/test').Page) => {
	const robotsTag = page.locator('meta[name="robots"]');
	const count = await robotsTag.count();

	if (count === 0) {
		return null;
	}

	if (count > 1) {
		throw new Error('Multiple robots meta tags found on page');
	}

	return await robotsTag.getAttribute('content');
};

test.describe('SEO Meta Tags - Robots Directives', () => {
	test.describe('System/Navigation Pages (should have noindex)', () => {
		test('tags index page has noindex,follow', async ({ page }) => {
			test.skip(isStaging, 'Staging has noindex,nofollow on all pages');

			await page.goto(resolveUrl('/tags/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});

		test('individual tag pages have noindex,follow', async ({ page }) => {
			test.skip(isStaging, 'Staging has noindex,nofollow on all pages');

			await page.goto(resolveUrl('/tags/ai/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});

		test('search page has noindex,follow', async ({ page }) => {
			test.skip(isStaging, 'Staging has noindex,nofollow on all pages');

			await page.goto(resolveUrl('/search/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});

		test('pagination pages have noindex,follow', async ({ page }) => {
			test.skip(isStaging, 'Staging has noindex,nofollow on all pages');

			await page.goto(resolveUrl('/posts/2/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});

		test('presentations index has noindex,follow', async ({ page }) => {
			test.skip(isStaging, 'Staging has noindex,nofollow on all pages');

			await page.goto(resolveUrl('/presentations/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});

		test('presentation directory pages have noindex,follow', async ({ page }) => {
			test.skip(isStaging, 'Staging has noindex,nofollow on all pages');

			await page.goto(resolveUrl('/presentations/wohd/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});
	});

	test.describe('Content Pages (should NOT have noindex)', () => {
		test('home page has no robots meta tag', async ({ page }) => {
			test.skip(isStaging, 'Staging has noindex,nofollow on all pages');

			await page.goto(resolveUrl('/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBeNull();
		});

		test('blog posts have no robots meta tag', async ({ page }) => {
			test.skip(isStaging, 'Staging has noindex,nofollow on all pages');

			// Test a known blog post
			await page.goto(resolveUrl('/posts/2026-02-02-fun-at-scale/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBeNull();
		});

		test('about page has no robots meta tag', async ({ page }) => {
			test.skip(isStaging, 'Staging has noindex,nofollow on all pages');

			await page.goto(resolveUrl('/about/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBeNull();
		});
	});

	test.describe('Staging Environment', () => {
		test('all pages have noindex,nofollow on staging', async ({ page }) => {
			test.skip(!isStaging, 'This test only runs on staging');

			// Test home page
			await page.goto(resolveUrl('/'), { waitUntil: 'networkidle' });
			let robotsContent = await getRobotsMetaTag(page);
			expect(robotsContent).toBe('noindex,nofollow');

			// Test a blog post
			await page.goto(resolveUrl('/posts/2026-02-02-fun-at-scale/'), { waitUntil: 'networkidle' });
			robotsContent = await getRobotsMetaTag(page);
			expect(robotsContent).toBe('noindex,nofollow');

			// Test a system page
			await page.goto(resolveUrl('/tags/'), { waitUntil: 'networkidle' });
			robotsContent = await getRobotsMetaTag(page);
			expect(robotsContent).toBe('noindex,nofollow');
		});
	});

	test.describe('Canonical URLs', () => {
		test('all pages have canonical URLs', async ({ page }) => {
			const pages = [
				'/',
				'/posts/',
				'/about/',
				'/tags/',
				'/search/',
				'/presentations/',
			];

			for (const pagePath of pages) {
				await page.goto(resolveUrl(pagePath), { waitUntil: 'networkidle' });

				const canonicalTag = page.locator('link[rel="canonical"]');
				const count = await canonicalTag.count();

				expect(count, `Expected exactly one canonical tag on ${pagePath}`).toBe(1);

				const href = await canonicalTag.getAttribute('href');
				expect(href, `Expected canonical href on ${pagePath} to be non-null`).not.toBeNull();
				expect(href, `Expected canonical href on ${pagePath} to be a valid URL`).toMatch(/^https?:\/\//);
			}
		});
	});
});
