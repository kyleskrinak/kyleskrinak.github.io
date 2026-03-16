# Staging URL Reference

**AUTHORITATIVE SOURCE**: This document defines the correct staging URL for all documentation.

## Current Staging URL

**Staging Environment**: `https://kyleskrinak.github.io/`

**⚠️ IMPORTANT**: Staging deploys to the **root** of the domain, NOT to a subpath like `/astro-blog/`.

## Why Staging Uses Root Path

**Repository Name**: `kyleskrinak.github.io`

This is a **GitHub Pages User Site** (not a Project Site), which has strict deployment rules:

| Repository Type | Repo Name Pattern | Deployment URL Pattern |
|----------------|-------------------|------------------------|
| **User Site** | `username.github.io` | `https://username.github.io/` (root only) |
| Project Site | Any other name | `https://username.github.io/repo-name/` (subpath) |

**GitHub Pages does not allow user sites to deploy to subpaths.** This is a platform constraint, not a configuration choice.

## Build Configuration

**staging-deploy.yml workflow**:
```yaml
BUILD_ENV: production          # Uses production build mode
PUBLIC_DEPLOY_ENV: staging     # But marks as staging environment
SITE_URL: https://kyleskrinak.github.io/
```

**astro.config.ts**:
```typescript
// Repository "kyleskrinak.github.io" is a GitHub Pages USER SITE and MUST deploy to root (/).
// GitHub Pages does not allow user sites to deploy to subpaths.
const base = "/";
```

**Current behavior**: Both staging and production use `base: "/"` (root path). This is required because the repository name matches the GitHub Pages user site pattern.

## Correct URLs in Documentation

When documenting or testing staging, use:

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

**Correct staging test commands** (no trailing slash to avoid double slashes in URL concatenation):
```bash
# Individual suite against staging
cross-env PLAYWRIGHT_TEST_BASE_URL=https://kyleskrinak.github.io npm run test:seo

# All suites against staging (package.json script)
npm run test:staging
```

**package.json should define**:
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

To verify the staging URL is correct:

1. **Check repository name**: `kyleskrinak.github.io` = user site = root deployment
2. **Check workflow build**: BUILD_ENV=production → base="/"
3. **Visit staging site**: https://kyleskrinak.github.io/ should load the site
4. **Check 404**: https://kyleskrinak.github.io/astro-blog/ should return 404

---

**Last Updated**: March 15, 2026
**Authority**: Deployment team
**Related**: [Deployment Guide](./deployment.md), [Build Configuration](./build-configuration.md)
