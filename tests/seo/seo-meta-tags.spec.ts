import { test, expect } from '@playwright/test';
import { BASE_URL } from '../test-utils';

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
			await page.goto(resolveUrl('/tags/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});

		test('individual tag pages have noindex,follow', async ({ page }) => {
			await page.goto(resolveUrl('/tags/ai/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});

		test('search page has noindex,follow', async ({ page }) => {
			await page.goto(resolveUrl('/search/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});

		test('pagination pages have noindex,follow', async ({ page }) => {
			// First page of paginated posts listing
			await page.goto(resolveUrl('/posts/'), { waitUntil: 'networkidle' });
			let robotsContent = await getRobotsMetaTag(page);
			expect(robotsContent, 'Expected /posts/ (first page) to have noindex,follow').toBe('noindex,follow');

			// Subsequent paginated page
			await page.goto(resolveUrl('/posts/2/'), { waitUntil: 'networkidle' });
			robotsContent = await getRobotsMetaTag(page);
			expect(robotsContent, 'Expected /posts/2/ to have noindex,follow').toBe('noindex,follow');
		});

		test('presentations index has noindex,follow', async ({ page }) => {
			await page.goto(resolveUrl('/presentations/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});

		test('presentation directory pages have noindex,follow', async ({ page }) => {
			await page.goto(resolveUrl('/presentations/wohd/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});

	// NOTE: Category pages test removed because no categories currently exist.
	// The template at src/pages/categories/[category].astro is configured with
	// noindex={true} for when categories are used. Add test when categories are
	// populated in blog posts.
	});

	test.describe('Functional Pages (should have noindex)', () => {
		test('404 page has noindex,follow', async ({ page }) => {
			await page.goto(resolveUrl('/404/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBe('noindex,follow');
		});
	});

	test.describe('Content Pages (should NOT have noindex)', () => {
		test('home page has no robots meta tag', async ({ page }) => {
			await page.goto(resolveUrl('/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBeNull();
		});

		test('blog posts have no robots meta tag', async ({ page }) => {
			// Test a blog post with past date for stability
			await page.goto(resolveUrl('/posts/2018-04-07-drupalcon-nashville-2018/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBeNull();
		});

		test('about page has no robots meta tag', async ({ page }) => {
			await page.goto(resolveUrl('/about/'), { waitUntil: 'networkidle' });
			const robotsContent = await getRobotsMetaTag(page);

			expect(robotsContent).toBeNull();
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

				// Verify canonical URL is a valid HTTPS URL (production)
				expect(href, `Expected canonical href on ${pagePath} to use HTTPS`).toMatch(/^https:\/\//);

				// Verify canonical URL path matches expected path
				const expectedUrl = resolveUrl(pagePath);
				const expectedUrlObj = new URL(expectedUrl);
				const canonicalUrlObj = new URL(href!);

				expect(
					canonicalUrlObj.pathname,
					`Expected canonical pathname to match ${expectedUrlObj.pathname} for ${pagePath}`
				).toBe(expectedUrlObj.pathname);

				// Verify canonical URL has a valid hostname (not localhost)
				expect(
					canonicalUrlObj.hostname,
					`Expected canonical URL to have production hostname for ${pagePath}`
				).not.toBe('localhost');

				// Verify canonical uses correct origin and path (production domain).
				// IMPORTANT: Domain is intentionally hardcoded (not derived from config)
				// so a misconfigured build cannot make this test pass against itself.
				// If the production domain changes, update this constant.
				const expectedOrigin = 'https://kyle.skrinak.com';
				const expectedPath = pagePath.endsWith('/') ? pagePath : `${pagePath}/`;
				const expectedCanonicalUrl = `${expectedOrigin}${expectedPath}`;

				expect(
					href,
					`Expected ${pagePath} canonical URL to be ${expectedCanonicalUrl}`
				).toBe(expectedCanonicalUrl);
			}
		});
	});
});
