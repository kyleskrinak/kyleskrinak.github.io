import { test, expect } from '@playwright/test';
import { BASE_URL } from './test-utils';

const resolveUrl = (path: string) => new URL(path, BASE_URL).toString();

/**
 * Layout Consistency Tests
 *
 * Verifies that all content-listing pages share the same structural layout:
 * - #main-content with app-layout class (from Main.astro)
 * - Breadcrumb navigation
 * - h1 heading
 * - Post list items rendered via Card component
 *
 * Pages tested: /posts/, /tags/, /tags/[tag]/
 */

const LAYOUT_PAGES = [
	{ name: 'posts index',    path: '/posts/' },
	{ name: 'tags index',     path: '/tags/' },
	{ name: 'tag detail',     path: '/tags/drupalcon/' },
	{ name: 'tag detail (hyphenated)', path: '/tags/code-plus/' },
];

test.describe('Layout Consistency', () => {
	for (const { name, path } of LAYOUT_PAGES) {
		test(`${name} uses Main layout`, async ({ page }) => {
			await page.goto(resolveUrl(path), { waitUntil: 'networkidle' });

			// Main.astro renders #main-content with app-layout class
			const main = page.locator('#main-content.app-layout');
			await expect(main).toBeVisible();

			// All content pages have an h1
			await expect(page.locator('h1').first()).toBeVisible();

			// Breadcrumb is rendered by Main.astro
			await expect(page.locator('nav[aria-label="breadcrumb"], .breadcrumb, nav').first()).toBeVisible();
		});
	}

	test('tag detail page renders post cards', async ({ page }) => {
		await page.goto(resolveUrl('/tags/drupalcon/'), { waitUntil: 'networkidle' });

		// Card.astro renders li items with post links
		const cards = page.locator('#main-content li');
		await expect(cards.first()).toBeVisible();
		expect(await cards.count()).toBeGreaterThan(0);

		// Each card has a link to a post
		const firstLink = cards.first().locator('a');
		await expect(firstLink).toBeVisible();
		const href = await firstLink.getAttribute('href');
		expect(href).toContain('/posts/');
	});

	test('posts index renders post cards', async ({ page }) => {
		await page.goto(resolveUrl('/posts/'), { waitUntil: 'networkidle' });

		const cards = page.locator('#main-content li');
		await expect(cards.first()).toBeVisible();
		expect(await cards.count()).toBeGreaterThan(0);

		const firstLink = cards.first().locator('a');
		await expect(firstLink).toBeVisible();
		const href = await firstLink.getAttribute('href');
		expect(href).toContain('/posts/');
	});

	test('tag detail and posts index share structural parity', async ({ page }) => {
		// Collect structure from posts page
		await page.goto(resolveUrl('/posts/'), { waitUntil: 'networkidle' });
		const postsHasAppLayout = await page.locator('#main-content.app-layout').count();
		const postsH1Text = await page.locator('h1').first().textContent();

		// Collect structure from tag page
		await page.goto(resolveUrl('/tags/drupalcon/'), { waitUntil: 'networkidle' });
		const tagHasAppLayout = await page.locator('#main-content.app-layout').count();
		const tagH1Text = await page.locator('h1').first().textContent();

		expect(postsHasAppLayout).toBe(tagHasAppLayout);
		expect(postsH1Text).toBeTruthy();
		expect(tagH1Text).toBeTruthy();
	});
});
