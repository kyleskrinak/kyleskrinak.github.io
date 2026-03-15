# Testing & Quality Assurance

This section covers testing strategies, test runs, and quality validation for the project.

## Testing Types

### Visual Regression Testing
- **[Visual Regression Guide](./visual-regression.md)** - Automated PR testing with Playwright
- Run with: `npm run test:visual` (local) or automatic on PRs
- Status: ✅ **Production** (March 2026) - automated CI/CD baseline comparison
- Tests 8+ key pages across 5 viewports to catch unexpected visual changes

### Console Error Testing
- **Test suite**: `tests/console-errors.spec.ts`
- Run with: `npm run test:console`
- Catches missing resources, syntax errors, 404s
- Validates all pages load without JavaScript errors

### Layout Consistency Testing
- **Test suite**: `tests/layout-consistency.spec.ts`
- Validates consistent layout elements across pages
- Checks navigation, footer, and common components
- Ensures no broken layout on key pages

### Analytics Privacy Testing
- **Test suites**:
  - `tests/analytics/analytics-privacy.spec.ts` - Cloudflare Analytics privacy compliance
  - `tests/analytics/analytics-privacy-ga.spec.ts` - Google Analytics privacy (if enabled)
- Validates respect for Do Not Track (DNT) signals
- Ensures Global Privacy Control (GPC) compliance
- Confirms analytics only load in production with valid tokens

### SEO & Sitemap Testing
- **Test suites**:
  - `tests/seo/seo-meta-tags.spec.ts` - Meta tags validation
  - `tests/seo/sitemap.spec.ts` - Sitemap accuracy
- Run with: `npm run test:seo`
- Validates proper meta tags, canonical URLs, noindex directives
- Ensures sitemap excludes noindex pages

### Link Validation Testing
- **Test suite**: `tests/link-validation.spec.ts`
- Run with: `npm run test:links`
- Two-tier verification (htmltest + Playwright browser checks)
- See [Link Checking Guide](../link-checking.md) for details

### Performance Testing
- **[Lighthouse Reports](../../reports/lighthouse/)** - Performance auditing
- See actual test results and historical trends

## Test Results

- **[Test Findings](./findings.md)** - Latest test run results and issues

## Running Tests

```bash
# Individual test suites (local development)
npm run test:visual          # Visual regression
npm run test:console         # Console errors
npm run test:seo             # SEO meta tags & sitemap
npm run test:links           # Link validation
npm run test:analytics       # Analytics privacy

# Run ALL tests against staging
npm run test:staging

# Run ALL tests against production
npm run test:production

# Run specific suite against staging/production
PLAYWRIGHT_TEST_BASE_URL=https://kyleskrinak.github.io/astro-blog npm run test:console
PLAYWRIGHT_TEST_BASE_URL=https://kyle.skrinak.com npm run test:seo
```

See [Testing Guide](../../tests/README.md) for detailed instructions.

---

Quality assurance is critical before launch. Use these tests to catch issues early!
