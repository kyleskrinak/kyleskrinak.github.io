// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Kyle Skrinak';
export const SITE_DESCRIPTION = 'Senior Manager, Digital Experience Platform for Gilead Sciences';
export const AUTHOR_NAME = 'Kyle Skrinak';
export const AUTHOR_EMAIL = 'kyle@skrinak.com';

// Utility function to prefix URLs with the base path (handles both production and staging)
// This is called at build time in .astro files where import.meta.env.BASE_URL is available
export function createPath(path: string): string {
	return `${import.meta.env.BASE_URL}${path.startsWith('/') ? path.slice(1) : path}`;
}
