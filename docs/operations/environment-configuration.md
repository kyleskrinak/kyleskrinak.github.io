# Environment Configuration Reference

> **⚠️ AUTO-GENERATED** from `config/registry.mjs`
> Do not edit manually - run `npm run config:generate`

## Environment Variable Matrix

| Variable | local-develop | staging-gh | pr-visual-check | main-aws |
|----------|----------|----------|----------|----------|
| `BUILD_ENV` | `production` | `production` ✓ | `production` ✓ | `production` ✓ |
| `SITE_URL` | (fallback: `https://kyle.skrinak.com/`) | `https://kyleskrinak.github.io/` ✓ | `https://kyle.skrinak.com/` ✓ | `https://kyle.skrinak.com/` ✓ |
| `PUBLIC_DEPLOY_ENV` | (omitted) | `staging` ✓ | `production` ✓ | `production` ✓ |
| `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` | (omitted) | `required` ✓ | `required` ✓ | `required` ✓ |
| `PUBLIC_GOOGLE_ANALYTICS_ID` | (omitted) | (omitted) | `required` ✓ | `required` ✓ |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | (omitted) | (omitted) | `required` ✓ | `required` ✓ |

✓ = Required | (fallback: ...) = Effective value from code fallback logic, not an explicitly set env var

## Build Flags

Astro build flags set automatically by the framework (not configurable via workflow env vars):

| Flag | local-develop | staging-gh | pr-visual-check | main-aws |
|------|----------|----------|----------|----------|
| `import.meta.env.PROD` | `false` | `true` | `true` | `true` |

## Astro Configuration

### base: `/`
- Location: astro.config.ts
- Reason: GitHub Pages user site must deploy to root
- Impacts: All URLs, Canonical paths, Asset paths

### trailingSlash: `always`
- Location: astro.config.ts
- Reason: Consistency with Jekyll URL structure
- Impacts:
  - Canonical URLs must end with /
  - Redirects preserve trailing slash
  - Link validation expects trailing /
  - Test assertions use trailing /

## Analytics Gating

### Cloudflare
- Gating: `import.meta.env.PROD && PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`
- Location: src/layouts/Layout.astro
- Test policy: Skip on local URLs to avoid prod-build setup

### Google Analytics
- Gating: `import.meta.env.PROD && PUBLIC_GOOGLE_ANALYTICS_ID`
- Location: src/components/GoogleAnalytics.astro
- Test policy: Skip on local URLs to avoid prod-build setup

**Key:** Analytics gating based on `import.meta.env.PROD`, NOT hostname.

## Deployment Infrastructure

### Staging (GitHub Pages)
- Platform: GitHub Pages
- Mechanism: GitHub Actions pages deployment
- Variables: None (uses automatic GITHUB_TOKEN)

### Production (AWS S3 + CloudFront)
- Platform: AWS S3 + CloudFront
- Mechanism: OIDC authentication + AWS CLI
- Variables (GitHub repository vars):
  - `AWS_ACCOUNT_ID`: github-var (used in .github/workflows/production-deploy.yml)
  - `AWS_DEPLOY_ROLE`: github-var (used in .github/workflows/production-deploy.yml)
  - `AWS_REGION`: github-var (used in .github/workflows/production-deploy.yml)
  - `AWS_S3_BUCKET`: github-var (used in .github/workflows/production-deploy.yml)
  - `AWS_CLOUDFRONT_DISTRIBUTION_ID`: github-var (used in .github/workflows/production-deploy.yml)

### PR Visual Check
- Platform: Local (no deployment)
- Mechanism: Build artifacts only
- Variables: None (build artifacts only, no deployment)
