import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Test that all important pages load without errors
test.describe('Link Validation', () => {
	test('home page loads', async ({ page }) => {
		await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
		expect(page).toHaveTitle(/Kyle Skrinak/);

		// Check that key elements exist
		await expect(page.locator('h1')).toContainText('Kyle Skrinak');
		await expect(page.locator('a[href="/blog"]')).toBeVisible();
	});

	test('blog index page loads', async ({ page }) => {
		await page.goto('http://localhost:3000/blog', { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Blog');

		// Check that at least one blog post link exists
		const postLinks = page.locator('a[href^="/blog/"]');
		expect(await postLinks.count()).toBeGreaterThan(0);
	});

	test('about page loads', async ({ page }) => {
		await page.goto('http://localhost:3000/about', { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('About');
	});

	test('search page loads', async ({ page }) => {
		await page.goto('http://localhost:3000/search', { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Search');
	});

	test('sample blog post loads', async ({ page }) => {
		await page.goto('http://localhost:3000/blog', { waitUntil: 'networkidle' });

		// Get the first post link and navigate to it
		const firstPostLink = page.locator('a[href^="/blog/"]').first();
		const href = await firstPostLink.getAttribute('href');

		if (href) {
			await page.goto(`http://localhost:3000${href}`, { waitUntil: 'networkidle' });
			await expect(page.locator('article')).toBeVisible();
		}
	});

	test('category page loads', async ({ page }) => {
		// Test a known category
		await page.goto('http://localhost:3000/categories/drupal', { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Category');
	});

	test('tag page loads', async ({ page }) => {
		// Test a known tag
		await page.goto('http://localhost:3000/tags/drupal', { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText('Tag');
	});

	test('no console errors on home page', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
		expect(errors).toEqual([]);
	});

	test('rss feed exists and is valid', async ({ page }) => {
		const response = await page.goto('http://localhost:3000/rss.xml');
		expect(response?.status()).toBe(200);
		expect(response?.headers()['content-type']).toContain('xml');
	});

	test('sitemap exists and is valid', async ({ page }) => {
		const response = await page.goto('http://localhost:3000/sitemap-index.xml');
		expect(response?.status()).toBe(200);
		expect(response?.headers()['content-type']).toContain('xml');
	});
});
