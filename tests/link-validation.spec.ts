import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4321';
const basePathname = (() => {
	const pathname = new URL(BASE_URL).pathname;
	if (pathname === '/' || pathname === '') return '';
	return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
})();

const withBasePath = (hrefPath: string) => `${basePathname}${hrefPath}`;
const resolveUrl = (hrefPath: string) => {
	if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(hrefPath)) {
		return new URL(hrefPath).toString();
	}

	let effectivePath = hrefPath;

	if (hrefPath.startsWith('/')) {
		if (basePathname && !hrefPath.startsWith(`${basePathname}/`) && hrefPath !== basePathname) {
			effectivePath = `${basePathname}${hrefPath}`;
		}
	}

	return new URL(effectivePath, BASE_URL).toString();
};

const getCanonicalHref = async (page: import('@playwright/test').Page) => {
	const canonicalLocator = page.locator('link[rel="canonical"]');
	const count = await canonicalLocator.count();
	expect(
		count,
		'Expected exactly one <link rel="canonical"> element on the page'
	).toBe(1);

	const href = await canonicalLocator.first().getAttribute('href');
	expect(href, 'Expected canonical link to have a non-null href attribute').not.toBeNull();

	return href!;
};

// Test that all important pages load without errors
test.describe('Link Validation', () => {
	test('home page loads', async ({ page }) => {
		await page.goto(resolveUrl('/'), { waitUntil: 'networkidle' });
		await expect(page).toHaveTitle(/Kyle Skrinak/);

		// Check that key elements exist
		await expect(page.locator('h1')).toContainText('Kyle Skrinak');
		await expect(page.locator(`a[href="${withBasePath('/posts/')}"]`)).toBeVisible();

		const canonical = await getCanonicalHref(page);
		expect(canonical).toMatch(/\/$/);
	});

	test('posts index page loads', async ({ page }) => {
		await page.goto(resolveUrl('/posts/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Posts');

		// Check that at least one post link exists
		const postLinks = page.locator(`a[href^="${withBasePath('/posts/')}"]`);
		expect(await postLinks.count()).toBeGreaterThan(0);

		const canonical = await getCanonicalHref(page);
		expect(canonical).toMatch(/\/$/);
	});

	test('about page loads', async ({ page }) => {
		await page.goto(resolveUrl('/about/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('About');
	});

	test('search page loads', async ({ page }) => {
		await page.goto(resolveUrl('/search/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Search');
	});

	test('sample post loads', async ({ page }) => {
		await page.goto(resolveUrl('/posts/'), { waitUntil: 'networkidle' });

		// Get the first post link and navigate to it
		const firstPostLink = page.locator(`a[href^="${withBasePath('/posts/')}"]`).first();
		const href = await firstPostLink.getAttribute('href');
		expect(href, 'Expected first post link to have a non-null href').not.toBeNull();

		await page.goto(resolveUrl(href!), { waitUntil: 'networkidle' });
		await expect(page.locator('article')).toBeVisible();

		const canonical = await getCanonicalHref(page);
		expect(canonical).toMatch(/\/$/);
	});

	test('category page loads', async ({ page }) => {
		// Test a known category
		await page.goto(resolveUrl('/categories/drupal/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Category');
	});

	test('tag page loads', async ({ page }) => {
		// Test a known tag
		await page.goto(resolveUrl('/tags/drupal/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Tag');
	});

	test('no console errors on home page', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		await page.goto(resolveUrl('/'), { waitUntil: 'networkidle' });
		expect(errors).toEqual([]);
	});

	test('rss feed exists and is valid', async ({ page }) => {
		const response = await page.goto(resolveUrl('/rss.xml'));
		expect(response?.status()).toBe(200);
		expect(response?.headers()['content-type']).toContain('xml');
	});

	test('sitemap exists and is valid', async ({ page }) => {
		const response = await page.goto(resolveUrl('/sitemap-index.xml'));
		expect(response?.status()).toBe(200);
		expect(response?.headers()['content-type']).toContain('xml');
	});

	test('presentations index page loads', async ({ page }) => {
		await page.goto(resolveUrl('/presentations/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Presentations');

		// Check that at least one presentation link exists
		const presLinks = page.locator(`a[href^="${withBasePath('/presentations/')}"]`);
		expect(await presLinks.count()).toBeGreaterThan(0);
	});

	test('presentation detail pages load with valid links', async ({ page }) => {
		await page.goto(resolveUrl('/presentations/'), { waitUntil: 'networkidle' });

		// Get the first presentation link
		const firstPresLink = page.locator(`a[href^="${withBasePath('/presentations/')}"][href$="/"]`).first();
		const href = await firstPresLink.getAttribute('href');
		expect(href, 'Expected first presentation link to have a non-null href').not.toBeNull();

		await page.goto(resolveUrl(href!), { waitUntil: 'networkidle' });

		// Check that the "View Presentation" button exists and has valid href
		const viewButton = page.locator('a:has-text("View Presentation")');
		await expect(viewButton).toBeVisible();

		const presHref = await viewButton.getAttribute('href');
		expect(presHref, 'Expected View Presentation href to be non-null').not.toBeNull();
		expect(presHref).toMatch(/^\/.*\.html$/);

		// Verify the presentation HTML file exists
		const response = await page.goto(resolveUrl(presHref!), { waitUntil: 'networkidle' });
		expect(response?.status()).toBe(200);
	});
});
