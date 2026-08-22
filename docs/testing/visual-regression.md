# Visual Regression Testing

## Status
✅ **ACTIVE** — CI gate on PRs to `staging`. Baselines committed to repo.

## Overview
Playwright visual regression tests for key pages. Baselines are committed in `tests/visual/visual-regression.spec.ts-snapshots/` (`snapshotPathTemplate` drops the OS suffix from filenames but keeps `{-projectName}`, so baselines stay per-project — it does not make the pixels themselves OS-agnostic; baselines must actually be *generated* on Ubuntu to match CI, see below). The `pr-visual-check.yml` workflow runs them as a gate on all PRs targeting `staging`.

## Local Development

### Commands
```bash
npm run test:visual                  # Run tests against local baseline
ALLOW_NATIVE_BASELINE=1 npm run test:visual:baseline   # Host-rendered baselines (local iteration only — do not commit; refuses without the env var)
npm run test:visual:docker           # Run tests in a container matching CI's Ubuntu font rendering
npm run test:visual:baseline:docker  # Generate baseline snapshots matching CI (use this before committing)
npm run test:visual:report           # View HTML report
```

The site uses a system font stack (no web fonts), so macOS and CI's Ubuntu runner resolve entirely different fonts (SF Mono vs Liberation/DejaVu Mono) with different glyphs and metrics — baselines generated with the bare `test:visual:baseline` reflect the host OS's font rendering and will fail CI whenever the host doesn't match CI's Ubuntu runner (e.g., macOS), even with no real visual change. All baseline regeneration intended for commit must go through the `:docker` variant. See `tests/visual/README.md#baseline-management` for details.

## Test Coverage
- 8+ key pages tested
- Multiple viewport sizes (mobile: 320px-414px, tablet: 768px, desktop: 1920px)
- Responsive design validation

## Workflows

### For Developers
1. Make UI changes
2. Run `npm run test:visual` locally
3. If diffs are expected, run `npm run test:visual:baseline:docker` to update snapshots against CI's Ubuntu font rendering, then commit the updated files in `tests/visual/visual-regression.spec.ts-snapshots/`

## Technical Details

See also:
- `/tests/visual/visual-regression.spec.ts` - Test implementation
- `/.github/workflows/pr-visual-check.yml` - CI gate workflow
- `playwright.config.ts` - `snapshotPathTemplate` removes OS suffix for cross-platform compatibility
