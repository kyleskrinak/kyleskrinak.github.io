# GitFlow Workflow

This document defines the branching strategy and PR workflow for the astro-blog project.

## Branch Structure

- **`develop`**: Main integration branch for active development. Work directly on this branch. Fast iteration, direct commits.
- **`staging`**: Pre-production testing environment. Receives validated changes from `develop`. Deploys to GitHub Pages. Tests the next release candidate before promoting to `main`.
- **`main`**: Production-ready code, always stable. Receives only validated releases from `staging` via PR. Deploys to kyle.skrinak.com via AWS S3 + CloudFront.
- **Feature branches** (optional): Use only when you need work isolation (long-running features, experimental work, or when working with others). Otherwise, commit directly to `develop`.

## Key Rules

1. **Work directly on `develop`**: For solo development, commit and push directly to `develop`. This is the fastest workflow.
2. **Feature branches are optional**: Use them only when you need isolation (experiments, long-running features, collaboration). Otherwise, they add overhead without benefit.
3. **`staging` is the pre-release gate**: Merge `develop` to `staging` for final testing before production. No PR required.
4. **`main` is production**: Requires PR from `staging`. Only validated, tested releases merge to `main`.
5. **Flow is linear**: `develop` → `staging` (test) → `main` (PR + release)
6. **Never commit directly to `main`**: All changes to production flow through the PR process.

## Standard Workflow (Direct to Develop)

**Default workflow for solo development**:
```bash
# 1. Make sure you're on develop and up to date
git checkout develop && git pull origin develop

# 2. Make changes and commit
# ... edit files ...
git add -A
git commit -m "feat(sitemap): exclude noindex pages from sitemap"

# 3. Push directly to develop
git push origin develop

# 4. When ready to test, merge to staging
git checkout staging && git pull origin staging
git merge develop --no-edit
git push origin staging

# 5. Validate on staging, then create PR: staging → main
gh pr create --base main --head staging --title "Release: description"
```

**When to use feature branches instead**:
- Long-running features that take days/weeks
- Experimental work you might abandon
- When you need to pause work and switch context
- When collaborating with others on the same feature

**Anti-patterns (never)**:
- ❌ Direct commits to `main`
- ❌ Pushing directly to `main`
- ❌ Merging to `main` without a PR
- ❌ Skipping validation on staging before promoting to main

**Why**: For solo development, feature branches add friction (create, merge, delete) without benefit. Work directly on `develop`, use `staging` as your testing gate, and gate production via PR to `main`.

## Before You Begin: Prerequisite State

Before starting new feature work, if no release or hotfix is in progress, verify that `staging` and `main` are aligned (and no pending PRs are blocking release). `develop` can be ahead, which is normal for active feature development.

```bash
# Check branch alignment
git fetch origin
echo "main:" && git rev-parse origin/main
echo "staging:" && git rev-parse origin/staging
```

`staging` and `main` SHAs should match when no release or hotfix is in progress. If not:

1. Check for pending PRs targeting `staging` or `main` that need merging first.
2. If PRs are merged, pull and verify alignment:
   ```bash
   git checkout staging
   git pull origin staging
   git checkout main
   git pull origin main
   ```

**Why**: `staging` and `main` must be in sync when you are not actively validating a release or hotfix. `develop` can be ahead (that's where active work happens), but release gates should be clean outside of those windows.

## Optional: Feature Branch Workflow

**Use this only when you need work isolation.** Otherwise, work directly on `develop`.

### 1. Create a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

**Naming convention**: Use `feature/`, `fix/`, `chore/`, or `docs/` prefixes.

### 2. Make Changes and Push

```bash
git add -A
git commit -m "feat(analytics): add Cloudflare beacon with env gate"
git push -u origin feature/your-feature-name
```

### 3. Merge Back to Develop

```bash
git checkout develop
git pull origin develop
git merge --no-ff feature/your-feature-name
git push origin develop
git branch -d feature/your-feature-name  # Delete local
git push origin --delete feature/your-feature-name  # Delete remote
```

**Notes:**
- Feature branches are temporary - delete after merge
- No PR required for merging to `develop`
- Use `--no-ff` to preserve merge commits

## Integrate Develop → Staging (When Ready for Testing)

When you have a set of features ready to validate in the staging environment, merge `develop` to `staging` (local merge or PR):

```bash
gh pr create --base staging --head develop --title "chore: sync staging with develop for testing"
```

Or via GitHub UI: Open a PR with base `staging`, head `develop` (optional).

Once merged and CI passes, staging automatically builds and deploys to GitHub Pages. Staging will be deindexed (robots.txt blocks crawlers; no effect on functionality).

Validate on Staging

- Feature works as expected in the staging environment.
- Check Cloudflare analytics dashboard if applicable (if you provided a staging token).
- Wait for ≥ 1 day if needed to ensure stability.

## Open PR: Staging → Main (Release PR)

Once staging is stable and validated:

- **Base**: `main`
- **Head**: `staging`
- **Title**: e.g., `Release: v1.2.0 — Add Cloudflare analytics`

**PR Checklist (stricter for releases):**

- [ ] Staging validated for ≥ 1 day with no issues.
- [ ] Changelog updated with all changes since last release.
- [ ] Version number decided (semantic versioning: MAJOR.MINOR.PATCH).
- [ ] Release notes prepared (copy from Changelog).
- [ ] No breaking changes, or breaking changes documented.
- [ ] Rollback plan documented if needed.

**Approval:** Requires strict approval; must be confident in the release.

## Merge to Main & Tag Release

Once approved and CI passes, merge via GitHub UI. Then tag:

```bash
git checkout main
git pull origin main

# Tag the release
git tag -a vX.Y.Z -m "Release: description"
git push origin vX.Y.Z
```

**Production deployment triggers automatically**: AWS production workflow runs `npm run build:ci` and publishes to S3 + CloudFront.

## Sync Branches After Release

After the release merge, if there are any commits on `main` that aren't on `develop`, sync them:

```bash
git checkout develop
git pull origin develop
git merge main
git push origin develop
```

Typically this isn't needed if all changes flow through `develop` first, but do this if hotfixes are applied directly to `main`.

## Branch Cleanup & Maintenance

After features are merged and releases are promoted, old branches accumulate on the remote. Regular cleanup keeps the repository clean and reduces confusion about which branches are active.

### When to Clean Up

- After a feature branch is merged to `develop` (immediate cleanup recommended)
- After a release is merged to `main` and tagged
- During milestone completion or monthly maintenance
- When branches clutter the branch list for new contributors

### Identifying Merged Branches

List branches that have been merged to `develop`:

```bash
git branch --merged develop
```

List branches merged to `staging`:

```bash
git branch --merged staging
```

List branches merged to `main`:

```bash
git branch --merged main
```

**Safe to delete**: Any branch listed that is not the current branch and is not `develop`, `staging`, or `main`.

### Safe Deletion Process

Branches tied to merged PRs are safe to delete. Always delete both locally and on `origin`:

```bash
# Delete locally
git branch -d feature/your-feature-name

# Delete on remote (origin)
git push origin --delete feature/your-feature-name
```

**Notes:**
- Use `-d` (lowercase) to refuse deletion if the branch hasn't been fully merged. Use `-D` (uppercase) only if you're certain the branch should be discarded.
- Deleting the remote branch does not affect the commit history; the commits remain in the merge commit of the branch that integrated it.

### Common Cleanup Scenarios

**Cleanup after merge to develop:**

```bash
# After PR is merged
git checkout develop
git pull origin develop
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

**Cleanup old feature branches in bulk:**

```bash
# Show merged branches (safe to delete)
git branch -r --merged develop | grep -v main | grep -v staging | grep -v develop

# Bulk delete (use carefully!)
git branch -r --merged develop | grep -v main | grep -v staging | grep -v develop | \
  sed 's|origin/||' | xargs -I {} git push origin --delete {}
```

**Cleanup local branches only:**

```bash
# Delete local branches that have been merged to develop
git branch --merged develop | grep -v develop | xargs -I {} git branch -d {}
```

### Branches to Never Delete

- ✅ `main` (production)
- ✅ `staging` (pre-release)
- ✅ `develop` (active integration)

### Cleanup Frequency

- **After every release**: Delete feature branches that were promoted.
- **Monthly**: Run `git branch --merged develop` to identify and remove stale branches.
- **Before major milestones**: Clean up to reduce noise for new contributors.

## Environment Variables

### Local Development

Use `.env` file (not committed; see `.env.example`):

```bash
PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=cfb_xxxxx
```

### Staging CI (GitHub Actions)

Set in GitHub Secrets:
- Variable name: `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`
- Value: (Cloudflare staging token, or leave blank to disable analytics)

### Production CI (AWS Pipeline)

Set in AWS Systems Manager Parameter Store or AWS Secrets Manager:
- Variable name: `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`
- Value: (Cloudflare production token)

**Note**: Features gate on the presence of `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`. Without a token, the feature doesn't load.

## Branch Protection Rules

Enforce via GitHub:

### `develop`
- Require CI to pass (GitHub Actions).
- Optional: Require PR review (recommended to catch issues early in feature development).

### `staging`
- Require CI to pass (GitHub Actions).
- Optional: Require PR review; can be less strict than `main` since it's a testing environment.

### `main`
- Require pull request review before merge (≥ 1 approval).
- Require CI to pass (GitHub Actions + Docker build).
- Require branches to be up to date before merge.
- Restrict who can push (e.g., only maintainers).
- Dismiss stale reviews on new commits.

To configure: Repository → Settings → Branches → Add Rule for `main` and `staging`.

## Rollback Strategy

### If a Feature on Develop or Staging is Broken

1. Identify the problematic commit(s).
2. Create a hotfix branch off the affected branch:
   ```bash
   # If the issue is on develop:
   git checkout -b hotfix/revert-broken-feature develop
   # Or if on staging:
   git checkout -b hotfix/revert-broken-feature staging
   ```
3. Revert the commit:
   ```bash
   git revert <commit-hash>
   git push -u origin hotfix/revert-broken-feature
   ```
4. Open a PR to the original branch, merge, validate, then propagate fixes upstream (to staging/main as needed).

### If Production is Broken

1. Create a hotfix branch off `main`:
   ```bash
   git checkout -b hotfix/production-fix
   # Fix the issue
   git push -u origin hotfix/production-fix
   ```
2. Open PR to `staging`, validate, then to `main`.
3. Tag and release.

### Quick Feature Toggle (No Code Change)

For features gated on env vars (e.g., Cloudflare analytics):

1. Remove or blank the token in AWS/GitHub Secrets.
2. Redeploy the existing build; feature is disabled instantly.
3. No rollback commit needed; revert the secret to re-enable.

## Conventional Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) for clear history:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `ci`

**Examples**:
- `feat(analytics): add Cloudflare beacon with DNT gate`
- `fix(build): correct pagefind output path`
- `docs(gitflow): add release procedure`

**Scope**: Optional; use feature or component name (e.g., `analytics`, `build`, `search`).

Commits are automatically parsed for `CHANGELOG.md` using [commitizen](https://github.com/commitizen/cz-cli).

## Changelog Management

### `CHANGELOG.md`

Maintained manually or via `npm run release` (if using standard-version).

**Format**: Keep one entry per release, dated, with sections for Features, Fixes, Docs, etc.

**Example**:

```markdown
## [1.2.0] - 2026-01-24

### Added
- Cloudflare Web Analytics integration (production-only beacon).
- GitFlow documentation and PR templates.

### Fixed
- Pagefind output directory path in build script.

### Changed
- Staging is now de-indexed (robots.txt, noindex meta tag).
```

Update before tagging a release.

## Release Checklist

Before merging `staging` → `main`:

- [ ] Staging has been tested for ≥ 1 day (or agreed testing window).
- [ ] All PRs from features to staging are merged.
- [ ] Changelog.md updated with version, date, features, fixes, breaking changes.
- [ ] Semantic version assigned (MAJOR.MINOR.PATCH).
- [ ] No open blocking issues or PRs.
- [ ] Rollback plan documented (if complex feature).
- [ ] Feature toggles (env vars) reviewed; production values set in AWS.

Once complete, merge `staging` → `main`, tag, and deploy.

## Questions & Troubleshooting

### Q: Can I commit directly to `develop`, `staging`, or `main`?

A: **`develop`**: Yes. Direct commits and pushes are allowed for fast iteration. Use feature branches + direct merge, or push directly.

**`staging`**: Yes. Direct commits and local merges are allowed when you want fast iteration or to batch tests.

**`main`**: No. All changes require PRs for audit, validation, and release control.

### Q: What if I need an urgent production fix?

A: Create a `hotfix/` branch off `main`, fix, PR to `staging`, validate quickly, then to `main`. Tag and release. Then sync `staging` ← `main`.

### Q: Can I rebase instead of merge?

A: We use merge commits (`--no-ff`) to preserve history. Rebase can work for feature branches before merging, but the final PR merge should use a merge commit.

### Q: How do I clean up old feature branches?

A: See [Branch Cleanup & Maintenance](#branch-cleanup--maintenance) for detailed guidance on identifying merged branches, safe deletion, and bulk cleanup strategies. Quick reference:

```bash
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

### Q: What if staging and main diverge?

A: Sync them after the release:

```bash
git checkout develop
git pull origin develop
git merge main
git push origin develop
```

Then optionally sync staging:

```bash
git checkout staging
git pull origin staging
git merge develop
git push origin staging
```

This ensures they stay in lockstep for future releases and development.
