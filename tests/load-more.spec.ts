import { test, expect } from '@playwright/test';
import { BASE_URL } from './test-utils';

const basePathname = (() => {
	const pathname = new URL(BASE_URL).pathname;
	if (pathname === '/' || pathname === '') return '';
	return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
})();

const resolveUrl = (hrefPath: string) => new URL(`${basePathname}${hrefPath}`, BASE_URL).toString();

type PostJson = { title: string; url: string; pubDate: string; updatedDate: string | null; description: string };

test.describe('Load More (blog listing progressive enhancement)', () => {
	test('page 1 starts with 5 posts and swaps pagination for a Load More button', async ({ page }) => {
		await page.goto(resolveUrl('/posts/'), { waitUntil: 'networkidle' });

		await expect(page.locator('#post-list > li')).toHaveCount(5);
		await expect(page.locator('nav[aria-label="Pagination Navigation"]')).toHaveCount(0);
		await expect(page.locator('#load-more-btn')).toBeVisible();
	});

	test('clicking Load More appends posts without changing the URL, and removes the button once exhausted', async ({
		page,
	}) => {
		const response = await page.request.get(resolveUrl('/posts/index.json'));
		expect(response.status()).toBe(200);
		const posts: PostJson[] = await response.json();

		await page.goto(resolveUrl('/posts/'), { waitUntil: 'networkidle' });
		const urlBefore = page.url();

		let previousCount = await page.locator('#post-list > li').count();
		expect(previousCount).toBe(5);

		const button = page.locator('#load-more-btn');
		const minBatchSize = 5;
		const maxClicks = Math.ceil((posts.length - previousCount) / minBatchSize) + 1;
		let clicks = 0;
		while ((await button.count()) > 0 && clicks < maxClicks) {
			await button.click();
			await expect
				.poll(async () => page.locator('#post-list > li').count())
				.toBeGreaterThan(previousCount);
			previousCount = await page.locator('#post-list > li').count();
			clicks++;
		}

		expect(page.url()).toBe(urlBefore);
		expect(previousCount).toBe(posts.length);
		await expect(page.locator('#load-more-btn')).toHaveCount(0);
	});

	test('page 2 renders statically with no Load More button or list', async ({ page }) => {
		await page.goto(resolveUrl('/posts/2/'), { waitUntil: 'networkidle' });

		await expect(page.locator('#load-more-btn')).toHaveCount(0);
		await expect(page.locator('ul[data-load-more]')).toHaveCount(0);
		await expect(page.locator('nav[aria-label="Pagination Navigation"]')).toBeVisible();
	});

	test('client-side navigation back to page 1 still shows the Load More button', async ({ page }) => {
		await page.goto(resolveUrl('/posts/2/'), { waitUntil: 'networkidle' });

		const firstPageLink = page.locator(`nav[aria-label="Pagination Navigation"] a[href="${basePathname}/posts/"]`).first();
		await firstPageLink.click();
		await page.waitForLoadState('networkidle');

		await expect(page.locator('#post-list > li')).toHaveCount(5);
		await expect(page.locator('#load-more-btn')).toBeVisible();
	});
});
