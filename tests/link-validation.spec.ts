import { test, expect } from '@playwright/test';
import { BASE_URL } from './test-utils';
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

		// Check that key elements exist (home page has no h1, check h2 instead)
		await expect(page.locator('h2').first()).toBeVisible();
		await expect(page.locator(`a[href="${withBasePath('/posts/')}"]`).first()).toBeVisible();

		const canonical = await getCanonicalHref(page);
		expect(canonical).toMatch(/\/$/);
	});

	test('posts index page loads', async ({ page }) => {
		await page.goto(resolveUrl('/posts/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1').first()).toContainText('Posts');

		// Check that at least one post link exists
		const postLinks = page.locator(`a[href^="${withBasePath('/posts/')}"]`);
		expect(await postLinks.count()).toBeGreaterThan(0);

		const canonical = await getCanonicalHref(page);
		expect(canonical).toMatch(/\/$/);
	});

	test('about page loads', async ({ page }) => {
		await page.goto(resolveUrl('/about/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1').first()).toContainText('About');
	});

	test('search page loads', async ({ page }) => {
		await page.goto(resolveUrl('/search/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1').first()).toContainText('Search');
	});

	test('sample post loads', async ({ page }) => {
		await page.goto(resolveUrl('/posts/'), { waitUntil: 'networkidle' });

		// Get the first post link and click it
		const firstPostLink = page.locator(`a[href^="${withBasePath('/posts/')}"]`).first();
		await firstPostLink.click();
		await page.waitForLoadState('networkidle');

		// Wait for article with longer timeout for client-side routing
		await expect(page.locator('article')).toBeVisible({ timeout: 10000 });

		const canonical = await getCanonicalHref(page);
		expect(canonical).toMatch(/\/$/);
	});

	test.skip('category page loads', async ({ page }) => {
		// Skip: No posts have categories (all have empty arrays)
		// Categories functionality exists but is unused
	});

	test('tag page loads', async ({ page }) => {
		// Test a known tag (using drupalcon since "drupal" doesn't exist)
		await page.goto(resolveUrl('/tags/drupalcon/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1').first()).toContainText('Tag');
	});

	test('code-plus tag page loads', async ({ page }) => {
		await page.goto(resolveUrl('/tags/code-plus/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1').first()).toContainText('Tag');
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
		const response = await page.goto(resolveUrl('/sitemap.xml'));
		expect(response?.status()).toBe(200);
		expect(response?.headers()['content-type']).toContain('xml');
	});

	test('presentations index page loads', async ({ page }) => {
		await page.goto(resolveUrl('/presentations/'), { waitUntil: 'networkidle' });
		await expect(page.locator('h1').first()).toContainText('Presentations');

		// Check that at least one presentation link exists
		const presLinks = page.locator(`a[href^="${withBasePath('/presentations/')}"]`);
		expect(await presLinks.count()).toBeGreaterThan(0);
	});

	test('presentation detail pages load with valid links', async ({ page }) => {
		await page.goto(resolveUrl('/presentations/'), { waitUntil: 'networkidle' });

		// Get the first presentation link and click it
		const firstPresLink = page.locator(`a[href^="${withBasePath('/presentations/')}"][href$="/"]`).first();
		await firstPresLink.click();
		await page.waitForLoadState('networkidle');

		// Check that the "View Presentation" button exists and has valid href
		const viewButton = page.locator('a:has-text("View Presentation")');
		await expect(viewButton).toBeVisible({ timeout: 10000 });

		const presHref = await viewButton.getAttribute('href');
		expect(presHref, 'Expected View Presentation href to be non-null').not.toBeNull();
		expect(presHref).toMatch(/^\/.*\.html$/);

		// Verify the presentation HTML file exists
		const response = await page.goto(resolveUrl(presHref!), { waitUntil: 'networkidle' });
		expect(response?.status()).toBe(200);
	});

	test('code presentation images load successfully', async ({ page }) => {
		const failedRequests: string[] = [];

		// Monitor network requests for image loading failures
		page.on('response', response => {
			const url = response.url();
			if (url.includes('/assets/images/code-plus/') && response.status() !== 200) {
				failedRequests.push(`${url} (${response.status()})`);
			}
		});

		await page.goto(resolveUrl('/presentations/code-presentation.html'), {
			waitUntil: 'networkidle',
		});

		// Verify no failed image requests
		expect(failedRequests, 'All presentation images should load successfully').toEqual([]);

		// Verify expected workflow images are present
		const images = page.locator('img[src^="/assets/images/code-plus/"]');
		expect(await images.count()).toBe(6);
	});

	test('presentation home link points to canonical root', async ({ page }) => {
		await page.goto(resolveUrl('/presentations/wohd.html'), { waitUntil: 'networkidle' });

		const homeLink = page.locator('a.home-link');
		await expect(homeLink).toBeVisible();

		const href = await homeLink.getAttribute('href');
		expect(href, 'Expected Home link to use a relative root path').toBe('../');

		await homeLink.click();
		await expect(page).toHaveURL(resolveUrl('/'));
	});
});
