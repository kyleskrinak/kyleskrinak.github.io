# Testing & Quality Assurance

This section covers testing strategies, test runs, and quality validation for the project.

## Testing Types

### Visual Regression Testing
- **[Visual Regression Guide](./visual-regression.md)** - Screenshot-based testing to catch UI changes
- Run with: `npm run test:visual`
- Tests across 36 pages to catch unexpected visual regressions

### Console Error Testing
- **[Console Error Tests](../getting-started/test-console.md)** - Browser console validation
- Run with: `npm run test:console`
- Catches missing resources, syntax errors, 404s

### Performance Testing
- **[Lighthouse Reports](../../reports/lighthouse/)** - Performance auditing
- See actual test results and historical trends

## Test Results

- **[Test Findings](./findings.md)** - Latest test run results and issues

## Running Tests

```bash
# Test locally (dev server running)
npm run test:console

# Test against staging
npm run test:console:staging

# Test against production
npm run test:console:production
```

See [Testing Guide](../../tests/README.md) for detailed instructions.

---

Quality assurance is critical before launch. Use these tests to catch issues early!
