# GitFlow Workflow

This document defines the branching strategy and PR workflow for the astro-blog project.

## Branch Structure

- **`main`**: Production-ready code, always stable. Deploys to kyle.skrinak.com via AWS S3 + CloudFront.
- **`staging`**: Pre-production testing environment. Deploys to GitHub Pages. Receives features from PRs, validates, then merges to `main`.
- **Feature branches**: Created off `main` (e.g., `feature/analytics-cloudflare`). Merged to `staging` for testing, then eventually to `main`.

## Key Rules

1. **`main` is always HEAD of production**: After every change, `main` should be the current production state.
2. **`staging` always reflects the next release candidate**: It may be ahead of `main` during development, but after approval it merges to `main` and the two sync.
3. **All changes flow through PRs**: No direct commits to `main` or `staging`.
4. **Feature branches are temporary**: Delete after merge.
5. **ALL changes use feature branches** — even docs, config, or internal updates. Never commit directly to `staging` or `main`.

## Critical Reminder: Feature Branch Discipline

**Pattern (always)**:
```
feature/xyz → PR to staging → validate → merge to staging → PR to main → tag & release
```

**Anti-patterns (never)**:
- ❌ Committing docs directly to `staging`
- ❌ Merging `main` → `staging` without a feature branch
- ❌ Direct commits to `main` or `staging`
- ❌ Skipping the PR step

**Why**: Maintains an auditable change history, ensures all code is reviewed, and prevents merge conflicts downstream. Every change, no matter how small, deserves the full workflow.

## Workflow: Feature Development

### 1. Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

**Naming convention**: Use `feature/`, `fix/`, `chore/`, or `docs/` prefixes matching [Conventional Commits](https://www.conventionalcommits.org/).

### 2. Make Changes

Edit files, commit with conventional messages:

```bash
git add .
git commit -m "feat(analytics): add Cloudflare beacon with env gate"
```

Commit messages should be clear and match the scope of work.

### 3. Push to Origin

```bash
git push -u origin feature/your-feature-name
```

### 4. Open PR: Feature → Staging

- **Base**: `staging`
- **Head**: `feature/your-feature-name`
- **Use the PR template** (auto-populated; fill in checklist items)
- **Link related issues** if applicable

**PR Checklist (auto-filled by template):**

- [ ] Code review completed (logic, security, conventions, no hardcoded secrets).
- [ ] Local build succeeds: `npm run build`.
- [ ] CI passes on the branch.
- [ ] Staging CI environment variables are configured (if needed).
- [ ] Feature validated on staging deployment.
- [ ] Changelog updated (if user-facing changes).
- [ ] No TypeScript/ESLint errors.

**Approval:** At least one reviewer must approve (can be yourself during solo development).

### 5. Merge to Staging

Once approved and CI passes:

```bash
# Via GitHub UI: Click "Merge pull request"
# Or via CLI:
git checkout staging
git pull origin staging
git merge --no-ff feature/your-feature-name
git push origin staging
```

**Notes:**
- Use `--no-ff` to preserve merge commits for clear history.
- Delete the feature branch after merge.

### 6. Validate on Staging

- Staging CI automatically builds and deploys to GitHub Pages.
- Verify the feature works as expected (no robots.txt blocks staging from validation; it's just not indexed).
- Check Cloudflare analytics dashboard if applicable.
- Wait for N days if needed to ensure stability.

### 7. Open PR: Staging → Main (Release PR)

Once staging is stable and approved:

- **Base**: `main`
- **Head**: `staging`
- **Title**: e.g., `Release: v1.2.0 — Add Cloudflare analytics`

**PR Checklist (stricter for releases):**

- [ ] Staging validated for N days with no issues.
- [ ] Changelog updated with all changes since last release.
- [ ] Version number decided (semantic versioning: MAJOR.MINOR.PATCH).
- [ ] Release notes prepared (copy from Changelog).
- [ ] No breaking changes, or breaking changes documented.
- [ ] Rollback plan documented if needed.

**Approval:** Requires strict approval; must be confident in the release.

### 8. Merge to Main & Tag Release

Once approved:

```bash
# Via GitHub UI: Click "Merge pull request"
# Or via CLI:
git checkout main
git pull origin main
git merge --no-ff staging
git push origin main

# Tag the release
git tag -a vX.Y.Z -m "Release: Add Cloudflare analytics"
git push origin vX.Y.Z
```

**Production deployment triggers automatically**: AWS production workflow runs `npm run build:ci` and publishes to S3 + CloudFront.

### 9. Sync Staging Back to Main (if needed)

After the release merge, if there are any commits on `main` that aren't on `staging`, sync them:

```bash
git checkout staging
git pull origin staging
git merge main
git push origin staging
```

Typically this isn't needed if all changes flow through staging first, but do this if hotfixes are applied directly to `main`.

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

### `main`
- Require pull request review before merge (≥ 1 approval).
- Require CI to pass (GitHub Actions + Docker build).
- Require branches to be up to date before merge.
- Restrict who can push (e.g., only maintainers).
- Dismiss stale reviews on new commits.

### `staging`
- Require CI to pass (GitHub Actions).
- (Optional) Require PR review; recommended for team workflows.

To configure: Repository → Settings → Branches → Add Rule for `main` and `staging`.

## Rollback Strategy

### If a Feature on Staging is Broken

1. Identify the problematic commit(s).
2. Create a hotfix branch off `staging`:
   ```bash
   git checkout -b hotfix/revert-broken-feature
   git revert <commit-hash>
   git push -u origin hotfix/revert-broken-feature
   ```
3. Open a PR to `staging`, merge, validate, then promote to `main`.

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

### Q: Can I commit directly to `main`?

A: No. All changes flow through PRs. This ensures review, CI validation, and audit trails.

### Q: What if I need an urgent production fix?

A: Create a `hotfix/` branch off `main`, fix, PR to `staging`, validate quickly, then to `main`. Tag and release. Then sync `staging` ← `main`.

### Q: Can I rebase instead of merge?

A: We use merge commits (`--no-ff`) to preserve history. Rebase can work for feature branches before merging, but the final PR merge should use a merge commit.

### Q: How do I clean up old feature branches?

A: After merge, delete locally and on origin:

```bash
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

### Q: What if staging and main diverge?

A: Sync them after the release:

```bash
git checkout staging
git merge main
git push origin staging
```

This ensures they stay in lockstep for future releases.
