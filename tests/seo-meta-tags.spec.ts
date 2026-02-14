import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4321';
const isStaging =
	process.env.PLAYWRIGHT_DEPLOY_ENV === 'staging' ||
	process.env.PUBLIC_DEPLOY_ENV === 'staging' ||
	BASE_URL.includes('github.io');

// Normalize base pathname to avoid double slashes (e.g., /site//tags/)
const basePathname = (() => {
	const rawPathname = new URL(BASE_URL).pathname;
	// When BASE_URL has no path (e.g. 'https://example.com'), URL.pathname is '/'
	// but we want to treat this as "no base path" so that resolveUrl('/foo')
	// becomes 'https://example.com/foo' and not 'https://example.com//foo'.
	if (rawPathname === '/') return '';
	// For non-root paths (e.g. 'https://example.com/site/'), strip a trailing slash
	// so that we can safely concatenate with effectivePath without creating '//'.
	return rawPathname.endsWith('/') ? rawPathname.slice(0, -1) : rawPathname;
})();

const resolveUrl = (path: string) => {
	const effectivePath = path.startsWith('/') ? path : `/${path}`;
	const fullPath = basePathname !== '' ? `${basePathname}${effectivePath}` : effectivePath;
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
			// NOTE: Local development behaves like production (isStaging=false),
			// so staging-specific tests are skipped in local dev. To test staging
			// behavior (including noindex,nofollow) locally, run the app with
			// PUBLIC_DEPLOY_ENV=staging (and optionally PLAYWRIGHT_DEPLOY_ENV=staging
			// so these staging-only tests are not skipped).

			// Test representative pages from each template type to ensure
			// staging directives are enforced everywhere, including pages
			// that don't use the Layout component
			const stagingPages = [
				'/', // home page
				'/posts/2026-02-02-fun-at-scale/', // existing blog post
				'/tags/', // tags index (system page)
				'/tags/ai/', // representative tag detail page
				'/posts/2/', // representative pagination page
				'/presentations/wohd/', // presentation landing directory page (not the .html presentation file)
			];

			for (const pagePath of stagingPages) {
				await page.goto(resolveUrl(pagePath), { waitUntil: 'networkidle' });
				const robotsContent = await getRobotsMetaTag(page);
				expect(
					robotsContent,
					`Expected ${pagePath} to have robots noindex,nofollow on staging`
				).toBe('noindex,nofollow');
			}
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

				// Verify canonical uses correct origin (production domain)
				// This catches issues like staging canonicalizing to itself instead of production
				if (!isStaging) {
					// On production/localhost: expect production canonicals
					const canonicalUrl = new URL(href!);
					const expectedOrigin = 'https://kyle.skrinak.com';
					expect(
						canonicalUrl.origin,
						`Expected ${pagePath} canonical to use production origin ${expectedOrigin}, got ${canonicalUrl.origin}`
					).toBe(expectedOrigin);
				}
				// TODO: Staging currently canonicalizes to github.io but should point to production
				// to avoid staging being indexed. Fix in separate PR.
			}
		});
	});
});
