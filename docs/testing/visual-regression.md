# Visual Regression Testing

## Status
✅ **PRODUCTION** (Implemented March 2026)

## Overview
Automated visual regression testing using Playwright + GitHub Actions artifacts.
Runs on all PRs to staging and main branches.

## Architecture

### Baseline Generation (Production Deploy)
- Workflow: `.github/workflows/production-deploy.yml`
- After successful AWS deploy, generates visual baseline
- Uploads as artifact: `visual-baseline-main`
- Retention: 90 days
- Non-blocking: Deploy succeeds even if baseline generation fails

### PR Testing Workflow
1. **Trigger**: PR opened/updated (pull_request events) to staging or main
2. **Workflow**: `.github/workflows/pr-visual-check.yml`
   - Downloads latest baseline from main
   - Builds PR code with production settings
   - Runs Playwright visual tests
   - Uploads diff images if failures detected
3. **Commenting**: `.github/workflows/pr-visual-comment.yml`
   - Secure workflow_run context
   - Posts/updates PR comment with results
   - Removes comment when tests pass

### Key Features
- Idempotent PR comments (updates existing, not duplicate spam)
- Pagination support (handles PRs with >30 comments)
- Proper PR matching by head SHA
- Only comments on actual visual regressions
- Security: PR code runs read-only, commenting in secure context

## Local Development

### Commands
```bash
npm run test:visual           # Run tests against local baseline
npm run test:visual:baseline  # Generate new baseline snapshots
npm run test:visual:report    # View HTML report
```

### Download Official Baseline
```bash
# Get latest successful production deploy run
RUN_ID=$(gh run list --workflow=production-deploy.yml --branch=main --status=success --limit=1 --json databaseId --jq '.[0].databaseId')

# Download baseline artifacts from that run
gh run download $RUN_ID --name visual-baseline-main --dir tests/visual/visual-regression.spec.ts-snapshots/
```

## Test Coverage
- 8+ key pages tested
- Multiple viewport sizes (mobile: 320px-414px, tablet: 768px, desktop: 1920px)
- Responsive design validation

## Workflows

### For Developers
1. Make UI changes
2. Run `npm run test:visual` locally
3. If diffs expected, document in PR
4. PR workflow runs automatically
5. Review diff artifacts if failures reported

### For Reviewers
1. Check PR comment for visual regression alerts
2. Download diff artifacts from workflow run
3. Review Playwright HTML report
4. Approve if changes intentional

## Troubleshooting

### "Visual Regression Detected" Comment
- **Cause**: Legitimate UI change or unexpected regression
- **Action**: Download diff artifacts, review images
- **Resolution**: Document intentional changes or fix regression

### "No baseline found" Warning
- **Cause**: First PR after enabling feature (check workflow logs)
- **Behavior**: Warning appears in logs, visual tests are skipped (PR check still passes)
- **Action**: Safe to merge, baseline will be created when PR reaches main
- **Resolution**: No action needed (no PR comment posted for this condition)

### Tests Pass Locally but Fail in CI
- **Cause**: Different rendering between local and CI environments
- **Action**: Download baseline to snapshots directory:
  ```bash
  # Get latest successful production deploy run
  RUN_ID=$(gh run list --workflow=production-deploy.yml --branch=main --status=success --limit=1 --json databaseId --jq '.[0].databaseId')
  gh run download $RUN_ID --name visual-baseline-main --dir tests/visual/visual-regression.spec.ts-snapshots/
  ```
- **Resolution**: Test against official baseline locally

## Technical Details

See also:
- `/tests/visual/README.md` - Developer guide (Note: describes old __screenshots__/ approach; current implementation uses artifact-based visual-regression.spec.ts-snapshots/)
- `/tests/visual/visual-regression.spec.ts` - Test implementation
- `/.github/workflows/pr-visual-check.yml` - CI workflow
