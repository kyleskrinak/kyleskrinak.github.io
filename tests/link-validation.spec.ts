import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4321';

const getCanonicalHref = async (page: import('@playwright/test').Page) => {
	return await page.locator('link[rel="canonical"]').getAttribute('href');
};

// Test that all important pages load without errors
test.describe('Link Validation', () => {
	test('home page loads', async ({ page }) => {
		await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
		expect(page).toHaveTitle(/Kyle Skrinak/);

		// Check that key elements exist
		await expect(page.locator('h1')).toContainText('Kyle Skrinak');
		await expect(page.locator('a[href="/posts/"]')).toBeVisible();

		const canonical = await getCanonicalHref(page);
		expect(canonical).toMatch(/\/$/);
	});

	test('posts index page loads', async ({ page }) => {
		await page.goto(`${BASE_URL}/posts/`, { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Posts');

		// Check that at least one post link exists
		const postLinks = page.locator('a[href^="/posts/"]');
		expect(await postLinks.count()).toBeGreaterThan(0);

		const canonical = await getCanonicalHref(page);
		expect(canonical).toMatch(/\/$/);
	});

	test('about page loads', async ({ page }) => {
		await page.goto(`${BASE_URL}/about/`, { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('About');
	});

	test('search page loads', async ({ page }) => {
		await page.goto(`${BASE_URL}/search/`, { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Search');
	});

	test('sample post loads', async ({ page }) => {
		await page.goto(`${BASE_URL}/posts/`, { waitUntil: 'networkidle' });

		// Get the first post link and navigate to it
		const firstPostLink = page.locator('a[href^="/posts/"]').first();
		const href = await firstPostLink.getAttribute('href');

		if (href) {
			await page.goto(`${BASE_URL}${href}`, { waitUntil: 'networkidle' });
			await expect(page.locator('article')).toBeVisible();

			const canonical = await getCanonicalHref(page);
			expect(canonical).toMatch(/\/$/);
		}
	});

	test('category page loads', async ({ page }) => {
		// Test a known category
		await page.goto(`${BASE_URL}/categories/drupal/`, { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Category');
	});

	test('tag page loads', async ({ page }) => {
		// Test a known tag
		await page.goto(`${BASE_URL}/tags/drupal/`, { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Tag');
	});

	test('no console errors on home page', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
		expect(errors).toEqual([]);
	});

	test('rss feed exists and is valid', async ({ page }) => {
		const response = await page.goto(`${BASE_URL}/rss.xml`);
		expect(response?.status()).toBe(200);
		expect(response?.headers()['content-type']).toContain('xml');
	});

	test('sitemap exists and is valid', async ({ page }) => {
		const response = await page.goto(`${BASE_URL}/sitemap-index.xml`);
		expect(response?.status()).toBe(200);
		expect(response?.headers()['content-type']).toContain('xml');
	});

	test('presentations index page loads', async ({ page }) => {
		await page.goto(`${BASE_URL}/presentations/`, { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Presentations');

		// Check that at least one presentation link exists
		const presLinks = page.locator('a[href^="/presentations/"]');
		expect(await presLinks.count()).toBeGreaterThan(0);
	});

	test('presentation detail pages load with valid links', async ({ page }) => {
		await page.goto(`${BASE_URL}/presentations/`, { waitUntil: 'networkidle' });

		// Get the first presentation link
		const firstPresLink = page.locator('a[href^="/presentations/"][href$="/"]').first();
		const href = await firstPresLink.getAttribute('href');

		if (href) {
			await page.goto(`${BASE_URL}${href}`, { waitUntil: 'networkidle' });

			// Check that the "View Presentation" button exists and has valid href
			const viewButton = page.locator('a:has-text("View Presentation")');
			await expect(viewButton).toBeVisible();

			const presHref = await viewButton.getAttribute('href');
			expect(presHref).toMatch(/^\/.*\.html$/);

			// Verify the presentation HTML file exists
			const response = await page.goto(`${BASE_URL}${presHref}`, { waitUntil: 'networkidle' });
			expect(response?.status()).toBe(200);
		}
	});
});
