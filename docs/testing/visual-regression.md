# Visual Regression Testing

## Status
⚠️ **LOCAL ONLY** — CI automation removed July 2026. No PR check workflow runs; tests run locally only.

## Overview
Playwright visual regression tests for key pages. Baselines are stored locally in `tests/visual/visual-regression.spec.ts-snapshots/` and managed by developers when making visual changes.

## Local Development

### Commands
```bash
npm run test:visual           # Run tests against local baseline
npm run test:visual:baseline  # Generate new baseline snapshots
npm run test:visual:report    # View HTML report
```

## Test Coverage
- 8+ key pages tested
- Multiple viewport sizes (mobile: 320px-414px, tablet: 768px, desktop: 1920px)
- Responsive design validation

## Workflows

### For Developers
1. Make UI changes
2. Run `npm run test:visual` locally
3. If diffs are expected, run `npm run test:visual:baseline` to update snapshots and commit the new baseline files

## Technical Details

See also:
- `/tests/visual/visual-regression.spec.ts` - Test implementation
