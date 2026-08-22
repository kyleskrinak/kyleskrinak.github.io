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
 * The footer h-card is what lets sites receiving a webmention identify the author.
 * Visual baselines only catch pixel drift -- they would pass just as happily with
 * p-name dropped or u-url pointing at the wrong origin, which is exactly what breaks
 * that identification. These assertions pin the microformat contract itself.
 */
test.describe('Representative h-card', () => {
	test('homepage exposes an h-card with p-name and u-url', async ({ page }) => {
		await page.goto(resolveUrl('/'), { waitUntil: 'networkidle' });

		const hCard = page.locator('.h-card');
		await expect(hCard).toHaveCount(1);

		// p-name and u-url share one anchor, so the card carries both a name and a URL.
		const nameUrl = hCard.locator('.p-name.u-url');
		await expect(nameUrl).toHaveCount(1);
		await expect(nameUrl).not.toBeEmpty();

		const photo = hCard.locator('img.u-photo');
		await expect(photo).toHaveCount(1);
		// Width/height are required for CLS; an h-card photo is no exception.
		await expect(photo).toHaveAttribute('width', /\d+/);
		await expect(photo).toHaveAttribute('height', /\d+/);
	});

	test('h-card u-url matches the homepage canonical URL', async ({ page }) => {
		// An h-card is only *representative* where its u-url matches the page's own URL.
		// Comparing against the rendered canonical (rather than a hardcoded domain) keeps
		// this correct across the production, staging, and local base URLs.
		await page.goto(resolveUrl('/'), { waitUntil: 'networkidle' });

		const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
		expect(canonical).toBeTruthy();

		// Resolve u-url against the document so a relative href is compared fairly.
		const uUrl = await page.locator('.h-card .u-url').evaluate((el) => (el as HTMLAnchorElement).href);

		expect(withSlash(uUrl)).toBe(withSlash(canonical as string));
	});

	test('interior pages omit the h-card', async ({ page }) => {
		// Rendering it site-wide would assert that every page represents the author.
		await page.goto(resolveUrl('/about/'), { waitUntil: 'networkidle' });
		await expect(page.locator('.h-card')).toHaveCount(0);
	});
});
