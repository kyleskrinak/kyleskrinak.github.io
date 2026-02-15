import { test, expect } from '@playwright/test';
import { BASE_URL } from '../test-utils';

// Normalize base pathname to avoid double slashes
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

test.describe('Sitemap Validation', () => {
	let sitemapContent: string;
	let sitemapUrls: string[];

	test.beforeAll(async ({ request }) => {
		const response = await request.get(resolveUrl('/sitemap.xml'));
		expect(response.ok()).toBeTruthy();
		sitemapContent = await response.text();

		// Extract all <loc> URLs from sitemap
		const locMatches = sitemapContent.matchAll(/<loc>(.*?)<\/loc>/g);
		sitemapUrls = Array.from(locMatches, match => match[1]);
	});

	test.describe('Pages that SHOULD be in sitemap (indexable content)', () => {
		test('includes home page', async () => {
			const productionDomain = 'https://kyle.skrinak.com';
			const homeUrl = `${productionDomain}/`;
			expect(sitemapUrls).toContain(homeUrl);
		});

		test('includes about page', async () => {
			const productionDomain = 'https://kyle.skrinak.com';
			const aboutUrl = `${productionDomain}/about/`;
			expect(sitemapUrls).toContain(aboutUrl);
		});

		test('includes archives page', async () => {
			const productionDomain = 'https://kyle.skrinak.com';
			const archivesUrl = `${productionDomain}/archives/`;
			expect(sitemapUrls).toContain(archivesUrl);
		});

		test('includes lchf page', async () => {
			const productionDomain = 'https://kyle.skrinak.com';
			const lchfUrl = `${productionDomain}/lchf/`;
			expect(sitemapUrls).toContain(lchfUrl);
		});

		test('includes individual blog posts', async () => {
			const productionDomain = 'https://kyle.skrinak.com';
			// Test a known blog post
			const postUrl = `${productionDomain}/posts/2018-04-07-drupalcon-nashville-2018/`;
			expect(sitemapUrls).toContain(postUrl);

			// Verify we have multiple blog posts
			const postUrls = sitemapUrls.filter(url => url.includes('/posts/') && url.match(/\/posts\/\d{4}-\d{2}-\d{2}-/));
			expect(postUrls.length).toBeGreaterThan(30); // We have 35+ posts
		});

		test('includes presentation HTML files', async () => {
			const productionDomain = 'https://kyle.skrinak.com';
			const presentationUrl = `${productionDomain}/presentations/wohd.html`;
			expect(sitemapUrls).toContain(presentationUrl);

			// Verify we have multiple presentations
			const presentationUrls = sitemapUrls.filter(url => url.includes('/presentations/') && url.endsWith('.html'));
			expect(presentationUrls.length).toBeGreaterThan(5); // We have 8 presentation HTML files
		});
	});

	test.describe('Pages that should NOT be in sitemap (noindex pages)', () => {
		test('excludes /tags/ listing page', async () => {
			const tagsUrls = sitemapUrls.filter(url => url.endsWith('/tags/'));
			expect(tagsUrls.length).toBe(0);
		});

		test('excludes individual tag pages', async () => {
			// Tag pages have format /tags/ai/, /tags/astro/, etc.
			const tagUrls = sitemapUrls.filter(url => url.match(/\/tags\/[^/]+\/$/));
			expect(tagUrls.length).toBe(0);
		});

		test('excludes /categories/ listing page', async () => {
			const categoriesUrls = sitemapUrls.filter(url => url.endsWith('/categories/'));
			expect(categoriesUrls.length).toBe(0);
		});

		test('excludes individual category pages', async () => {
			// Category pages have format /categories/something/
			const categoryUrls = sitemapUrls.filter(url => url.match(/\/categories\/[^/]+\/$/));
			expect(categoryUrls.length).toBe(0);
		});

		test('excludes /posts/ listing page', async () => {
			const productionDomain = 'https://kyle.skrinak.com';
			const postsListingUrl = `${productionDomain}/posts/`;
			expect(sitemapUrls).not.toContain(postsListingUrl);
		});

		test('excludes pagination pages', async () => {
			// Pagination pages have format /posts/2/, /posts/3/, etc.
			const paginationUrls = sitemapUrls.filter(url => url.match(/\/posts\/\d+\/$/));
			expect(paginationUrls.length).toBe(0);
		});

		test('excludes /presentations/ listing page', async () => {
			const productionDomain = 'https://kyle.skrinak.com';
			const presentationsListingUrl = `${productionDomain}/presentations/`;
			expect(sitemapUrls).not.toContain(presentationsListingUrl);
		});

		test('excludes presentation directory pages', async () => {
			// Directory pages have format /presentations/wohd/ (not .html)
			const directoryUrls = sitemapUrls.filter(url => url.includes('/presentations/') && !url.endsWith('.html') && url !== 'https://kyle.skrinak.com/presentations/');
			expect(directoryUrls.length).toBe(0);
		});

		test('excludes /search/ page', async () => {
			const productionDomain = 'https://kyle.skrinak.com';
			const searchUrl = `${productionDomain}/search/`;
			expect(sitemapUrls).not.toContain(searchUrl);
		});

		test('excludes /404/ page', async () => {
			const productionDomain = 'https://kyle.skrinak.com';
			const notFoundUrl = `${productionDomain}/404/`;
			expect(sitemapUrls).not.toContain(notFoundUrl);
		});
	});

	test.describe('Sitemap format validation', () => {
		test('is valid XML with correct namespace', async () => {
			expect(sitemapContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(sitemapContent).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
			expect(sitemapContent).toContain('</urlset>');
		});

		test('all URLs use production domain (not staging)', async () => {
			const productionDomain = 'https://kyle.skrinak.com';
			sitemapUrls.forEach(url => {
				expect(url.startsWith(productionDomain), `Expected ${url} to start with ${productionDomain}`).toBeTruthy();
			});
		});

		test('all URLs have trailing slashes (except .html files)', async () => {
			sitemapUrls.forEach(url => {
				if (!url.endsWith('.html')) {
					expect(url.endsWith('/'), `Expected ${url} to have trailing slash`).toBeTruthy();
				}
			});
		});

		test('all URLs have lastmod dates', async () => {
			const lastmodMatches = sitemapContent.matchAll(/<lastmod>(.*?)<\/lastmod>/g);
			const lastmodDates = Array.from(lastmodMatches, match => match[1]);

			// Should have same number of lastmod tags as URLs
			expect(lastmodDates.length).toBe(sitemapUrls.length);

			// All dates should be in YYYY-MM-DD format
			lastmodDates.forEach(date => {
				expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			});
		});
	});

	test.describe('Sitemap completeness', () => {
		test('contains expected number of URLs', async () => {
			// 4 static pages + 35+ posts + 8 presentations = ~47+ URLs
			expect(sitemapUrls.length).toBeGreaterThanOrEqual(47);
			expect(sitemapUrls.length).toBeLessThan(100); // Sanity check
		});

		test('no duplicate URLs', async () => {
			const uniqueUrls = new Set(sitemapUrls);
			expect(uniqueUrls.size).toBe(sitemapUrls.length);
		});
	});
});
