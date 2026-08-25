# GitFlow Workflow

This document defines the branching strategy and PR workflow for the kyleskrinak.github.io project.

## Branch Structure

- **`develop`**: Main integration branch for active development. Work directly on this branch. Fast iteration, direct commits.
- **`main`**: Production-ready code, always stable. Receives only validated releases from `develop` via PR. Deploys to kyle.skrinak.com via AWS S3 + CloudFront.
- **Feature branches** (optional): Use only when you need work isolation (long-running features, experimental work, or when working with others). Otherwise, commit directly to `develop`.

## Key Rules

1. **Work directly on `develop`**: For solo development, commit and push directly to `develop`. This is the fastest workflow.
2. **Feature branches are optional**: Use them only when you need isolation (experiments, long-running features, collaboration). Otherwise, they add overhead without benefit.
3. **`main` is production**: Requires PR from `develop`. The PR runs build, config-validate, and visual-regression checks before merge.
4. **Flow is linear**: `develop` → `main` (PR + release)
5. **Never commit directly to `main`**: All changes to production flow through the PR process.

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

# 4. When ready to release, create PR: develop → main
gh pr create --base main --head develop --title "Release: description"
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
- ❌ Skipping the PR's build/config-validate/visual-regression checks before merging

**Why**: For solo development, feature branches add friction (create, merge, delete) without benefit. Work directly on `develop`, and gate production via PR to `main`.

## Before You Begin: Prerequisite State

Before starting new feature work, if no release or hotfix is in progress, verify that `develop` and `main` aren't already diverged in a way that would block a clean release (and no pending PRs are blocking release).

```bash
# Check branch alignment
git fetch origin
echo "main:" && git rev-parse origin/main
echo "develop:" && git rev-parse origin/develop
```

If `develop` is behind `main` (e.g. after a hotfix landed directly on `main`), sync it:

```bash
git checkout develop
git pull --ff-only origin develop
git merge --ff-only origin/main
git push origin develop
```

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

## Open PR: Develop → Main (Release PR)

Once `develop` is ready to ship:

- **Base**: `main`
- **Head**: `develop`
- **Title**: e.g., `Release: v1.2.0 — Add Cloudflare analytics`

Opening the PR triggers the build, config-validate, and visual-regression checks (`pr-visual-check.yml`, `unit-tests.yml`, `supply-chain-audit.yml`). All must pass before merge.

**PR Checklist (stricter for releases):**

- [ ] CI checks pass (build, config-validate, visual regression).
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

List branches merged to `main`:

```bash
git branch --merged main
```

**Safe to delete**: Any branch listed that is not the current branch and is not `develop` or `main`.

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
git branch -r --merged develop | grep -v main | grep -v develop

# Bulk delete (use carefully!)
git branch -r --merged develop | grep -v main | grep -v develop | \
  sed 's|origin/||' | xargs -I {} git push origin --delete {}
```

**Cleanup local branches only:**

```bash
# Delete local branches that have been merged to develop
git branch --merged develop | grep -v develop | xargs -I {} git branch -d {}
```

### Branches to Never Delete

- ✅ `main` (production)
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

### `main`
- Require pull request review before merge (≥ 1 approval).
- Require CI to pass (GitHub Actions + Docker build).
- Require branches to be up to date before merge.
- Restrict who can push (e.g., only maintainers).
- Dismiss stale reviews on new commits.

To configure: Repository → Settings → Branches → Add Rule for `main`.

## Rollback Strategy

### If a Feature on Develop is Broken

1. Identify the problematic commit(s).
2. Create a hotfix branch off `develop`:
   ```bash
   git checkout -b hotfix/revert-broken-feature develop
   ```
3. Revert the commit:
   ```bash
   git revert <commit-hash>
   git push -u origin hotfix/revert-broken-feature
   ```
4. Open a PR to `develop`, merge, validate, then propagate the fix to `main` in the next release PR.

### If Production is Broken

1. Create a hotfix branch off `main`:
   ```bash
   git checkout -b hotfix/production-fix
   # Fix the issue
   git push -u origin hotfix/production-fix
   ```
2. Open PR to `main`, validate, then merge.
3. Tag and release. Sync `develop` from `main` afterward (see [Sync Branches After Release](#sync-branches-after-release)).

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

## Changelog Management

### `CHANGELOG.md`

Maintained manually in this project. Commit messages follow conventional format for clarity, but CHANGELOG entries are written by hand.

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
- Preview deploys are now de-indexed (robots.txt, noindex meta tag).
```

Update before tagging a release.

## Release Checklist

Before merging `develop` → `main`:

- [ ] CI checks pass (build, config-validate, visual regression).
- [ ] All feature branches intended for this release are merged to `develop`.
- [ ] Changelog.md updated with version, date, features, fixes, breaking changes.
- [ ] Semantic version assigned (MAJOR.MINOR.PATCH).
- [ ] No open blocking issues or PRs.
- [ ] Rollback plan documented (if complex feature).
- [ ] Feature toggles (env vars) reviewed; production values set in AWS.

Once complete, merge `develop` → `main`, tag, and deploy.

## Questions & Troubleshooting

### Q: Can I commit directly to `develop` or `main`?

A: **`develop`**: Yes. Direct commits and pushes are allowed for fast iteration. Use feature branches + direct merge, or push directly.

**`main`**: No. All changes require PRs for audit, validation, and release control.

### Q: What if I need an urgent production fix?

A: Create a `hotfix/` branch off `main`, fix, PR to `main`, validate quickly, merge. Tag and release. Then sync `develop` from `main`.

### Q: Can I rebase instead of merge?

A: We use merge commits (`--no-ff`) to preserve history. Rebase can work for feature branches before merging, but the final PR merge should use a merge commit.

### Q: How do I clean up old feature branches?

A: See [Branch Cleanup & Maintenance](#branch-cleanup--maintenance) for detailed guidance on identifying merged branches, safe deletion, and bulk cleanup strategies. Quick reference:

```bash
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

### Q: What if develop and main diverge unexpectedly?

A: Sync them after the release:

```bash
git checkout develop
git pull origin develop
git merge main
git push origin develop
```

This ensures they stay in lockstep for future releases and development.
