# Visual Regression Testing

## Status
✅ **ACTIVE** — CI gate on PRs to `staging`. Baselines committed to repo.

## Overview
Playwright visual regression tests for key pages. Baselines are committed in `tests/visual/visual-regression.spec.ts-snapshots/` (OS-agnostic names via `snapshotPathTemplate`). The `pr-visual-check.yml` workflow runs them as a gate on all PRs targeting `staging`.

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
3. If diffs are expected, run `npm run test:visual:baseline` to update snapshots, then commit the updated files in `tests/visual/visual-regression.spec.ts-snapshots/`

## Technical Details

See also:
- `/tests/visual/visual-regression.spec.ts` - Test implementation
- `/.github/workflows/pr-visual-check.yml` - CI gate workflow
- `playwright.config.ts` - `snapshotPathTemplate` removes OS suffix for cross-platform compatibility
