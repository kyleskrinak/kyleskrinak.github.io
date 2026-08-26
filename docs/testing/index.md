# Testing & Quality Assurance

This section covers testing strategies, test runs, and quality validation for the project.

## Testing Types

### Visual Regression Testing
- **[Visual Regression Guide](./visual-regression.md)** - Playwright visual tests with committed baselines
- Run with: `npm run test:visual` (local) or automatic on PRs to `main` (`pr-visual-check.yml`)
- Status: ✅ **Active** (July 2026) - committed baselines, CI gate on PRs to main
- Tests 8+ key pages across multiple viewports (mobile, tablet, desktop) to catch unexpected visual changes

### Console Error Testing
- **Test suite**: `tests/console-errors.spec.ts`
- Run with: `npm run test:console`
- Catches missing resources, syntax errors, 404s
- Validates key pages load without JavaScript errors

### Layout Consistency Testing
- **Test suite**: `tests/layout-consistency.spec.ts`
- Run with: `npx playwright test --project=layout`
- Validates Main.astro layout structure (#main-content.app-layout)
- Checks breadcrumb navigation and h1 presence
- Ensures post card list items render correctly
- Verifies structural parity across content-listing pages (posts, tags)

### Analytics Privacy Testing
- **Test suite**: `tests/analytics/analytics-privacy.spec.ts` - Cloudflare Analytics privacy compliance
- Validates respect for Do Not Track (DNT) signals
- Ensures Global Privacy Control (GPC) compliance
- Confirms analytics load only in production builds when a token is configured (staging token optional)

### SEO & Sitemap Testing
- **Test suites**:
  - `tests/seo/seo-meta-tags.spec.ts` - Meta tags validation
  - `tests/seo/sitemap.spec.ts` - Sitemap accuracy
- Run with: `npm run test:seo`
- Validates proper meta tags, canonical URLs, noindex directives
- Ensures sitemap excludes noindex pages

### Link Validation Testing
- **Test suite**: `tests/link-validation.spec.ts`
- Run with: `npm run test:links` (Playwright browser verification only)
- For two-tier validation (htmltest + Playwright), use: `npm run check:links`
- See [Link Checking Guide](../link-checking.md) for details

### Performance Testing
- **Lighthouse Reports** - Performance auditing (reports saved to `lighthouse-reports/` directory, gitignored)
- Generate reports: Run Lighthouse against production (`kyle.skrinak.com`) — the GitHub Pages fallback normally serves a redirect stub, not the real site
- View historical trends in local `lighthouse-reports/` directory after running audits

## Test Results

- **[Test Findings](./findings.md)** - Latest test run results and issues

## Running Tests

```bash
# Individual test suites (local development)
npm run test:visual          # Visual regression
npm run test:console         # Console errors
npm run test:seo             # SEO meta tags & sitemap
npm run test:links           # Link validation
npm run test:analytics       # Analytics privacy (requires non-local PLAYWRIGHT_TEST_BASE_URL)

# Run all Playwright test suites against production
npm run test:production

# Run specific suite against production (cross-platform)
cross-env PLAYWRIGHT_TEST_BASE_URL=https://kyle.skrinak.com npm run test:seo

# Run all Playwright test suites against the GitHub Pages disaster-recovery fallback
# — only meaningful after a manual `mode=full-fallback` dispatch has run and before
# it's overwritten by a `mode=stub` redeploy (it does not revert automatically when
# the workflow finishes); otherwise this just tests the redirect stub.
# CAUTION: the seo project auto-detects any github.io base URL as "staging" and
# asserts noindex,nofollow on every page (see tests/test-utils.ts isStaging), which
# will report false failures against a full-fallback deploy (production-like,
# indexable content). Exclude it, e.g.:
#   npm run test:staging -- --project=console --project=visual-desktop --project=visual-mobile --project=analytics --project=links --project=layout
# See docs/operations/staging-url-reference.md.
npm run test:staging
cross-env PLAYWRIGHT_TEST_BASE_URL=https://kyleskrinak.github.io npm run test:console
```

See [Testing Guide](../../tests/README.md) for detailed instructions.

---

Quality assurance is critical before launch. Use these tests to catch issues early!
