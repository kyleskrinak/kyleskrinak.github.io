# GitHub Pages Fallback URL Reference

**AUTHORITATIVE SOURCE**: This document defines the correct URL for the GitHub Pages disaster-recovery fallback.

## Current Fallback URL

**GitHub Pages disaster-recovery fallback**: `https://kyleskrinak.github.io/`

**⚠️ IMPORTANT**: This URL normally serves a small redirect stub (meta-refresh + canonical to `kyle.skrinak.com`, `noindex,nofollow`), not the real site. It mirrors production content only after a manual `workflow_dispatch` of `staging-deploy.yml` with `mode=full-fallback` runs, and keeps serving that content until a `mode=stub` dispatch overwrites it — it does not revert automatically when the workflow run finishes. See [Deployment Guide](./deployment.md). It deploys to the **root** of the domain, NOT to a subpath like `/astro-blog/`.

## Why the Fallback Uses Root Path

**Repository Name**: `kyleskrinak.github.io`

This is a **GitHub Pages User Site** (not a Project Site), which has strict deployment rules:

| Repository Type | Repo Name Pattern | Deployment URL Pattern |
|----------------|-------------------|------------------------|
| **User Site** | `username.github.io` | `https://username.github.io/` (root only) |
| Project Site | Any other name | `https://username.github.io/repo-name/` (subpath) |

**GitHub Pages does not allow user sites to deploy to subpaths.** This is a platform constraint, not a configuration choice.

## Build Configuration

**staging-deploy.yml workflow** (`mode=full-fallback` build path — manual dispatch to deploy, or a quarterly `schedule` dry run that never deploys):
```yaml
BUILD_ENV: production
PUBLIC_DEPLOY_ENV: production   # Full-fallback behaves like production, not a staging environment
SITE_URL: https://kyle.skrinak.com/
```

**astro.config.ts**:
```typescript
// Repository "kyleskrinak.github.io" is a GitHub Pages USER SITE and MUST deploy to root (/).
// GitHub Pages does not allow user sites to deploy to subpaths.
const base = "/";
```

**Current behavior**: `base: "/"` applies regardless of which target is deployed. This is required because the repository name matches the GitHub Pages user site pattern.

## Correct URLs in Documentation

When documenting or testing the fallback, use:

✅ **CORRECT** (for display/links):
- `https://kyleskrinak.github.io/` (with or without trailing slash)
- `https://kyleskrinak.github.io/posts/`
- `https://kyleskrinak.github.io/about/`

✅ **CORRECT** (for base URL in commands - no trailing slash):
- `https://kyleskrinak.github.io` (prevents double slashes in URL concatenation)

❌ **INCORRECT** (does not exist):
- ~~`https://kyleskrinak.github.io/astro-blog/`~~
- ~~`https://kyleskrinak.github.io/astro-blog/posts/`~~

## Test Commands

**⚠️ These only produce meaningful results after a `mode=full-fallback` dispatch has run and before it's overwritten by a `mode=stub` redeploy** — at any other time `kyleskrinak.github.io` serves the redirect stub, and these commands will just test that stub, not the real site. No trailing slash, to avoid double slashes in URL concatenation:

`isStaging` (see `tests/test-utils.ts`) no longer auto-detects staging from a `github.io` base URL — a `mode=full-fallback` deploy builds with `PUBLIC_DEPLOY_ENV=production`, so `test:seo` correctly expects production-like (indexable) behavior against it:
```bash
# Individual suite against the fallback
cross-env PLAYWRIGHT_TEST_BASE_URL=https://kyleskrinak.github.io npm run test:seo

# All suites against the fallback (package.json script)
npm run test:staging
```

**package.json defines**:
```json
{
  "test:staging": "cross-env PLAYWRIGHT_TEST_BASE_URL=https://kyleskrinak.github.io playwright test"
}
```

## Historical Context

Earlier documentation incorrectly referenced `/astro-blog/` as a staging subpath. This was based on:
1. Misunderstanding of the astro.config.ts staging condition (which never executes)
2. Assumption that staging used a different base path than production

The confusion was resolved by understanding GitHub Pages user site deployment constraints.

## Verification

To verify the fallback URL is correct:

1. **Check repository name**: `kyleskrinak.github.io` = user site = root deployment
2. **Check workflow build**: full-fallback dispatch → BUILD_ENV=production, PUBLIC_DEPLOY_ENV=production → base="/"
3. **Visit the URL**: https://kyleskrinak.github.io/ should show the redirect stub by default, or the real site after a full-fallback dispatch has run and before it's overwritten by a stub redeploy
4. **Check 404**: https://kyleskrinak.github.io/astro-blog/ should return 404

---

**Last Updated**: August 25, 2026
**Authority**: Deployment team
**Related**: [Deployment Guide](./deployment.md), [Build Configuration](./build-configuration.md)
