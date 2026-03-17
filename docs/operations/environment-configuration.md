# Environment Configuration Reference

> **⚠️ AUTO-GENERATED** from `config/registry.mjs`
> Do not edit manually - run `npm run config:generate`

## Environment Variable Matrix

| Variable | local-develop | staging-gh | pr-visual-check | main-aws |
|----------|----------|----------|----------|----------|
| `BUILD_ENV` | `production` | `production` ✓ | `production` ✓ | `production` ✓ |
| `SITE_URL` | `null` | `https://kyleskrinak.github.io/` ✓ | `https://kyle.skrinak.com/` ✓ | `https://kyle.skrinak.com/` ✓ |
| `import.meta.env.PROD` | `false` | `true` | `true` | `true` |
| `PUBLIC_DEPLOY_ENV` | - | `staging` ✓ | `production` ✓ | `production` ✓ |
| `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` | - | `required` ✓ | `required` ✓ | `required` ✓ |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | - | - | `required` | `required` |

✓ = Required

## Astro Configuration

### base: `/`
- Location: astro.config.ts:21
- Reason: GitHub Pages user site must deploy to root
- Impacts: All URLs, Canonical paths, Asset paths

### trailingSlash: `always`
- Location: astro.config.ts:26
- Reason: Consistency with Jekyll URL structure
- Impacts:
  - Canonical URLs must end with /
  - Redirects preserve trailing slash
  - Link validation expects trailing /
  - Test assertions use trailing /

## Analytics Gating

### Cloudflare
- Gating: `import.meta.env.PROD && PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`
- Location: src/layouts/Layout.astro:214
- Test policy: Skip on local URLs to avoid prod-build setup

### Google Analytics
- Gating: `import.meta.env.PROD`
- Location: src/components/GoogleAnalytics.astro:7
- Test policy: Skip on local URLs to avoid prod-build setup

**Key:** Analytics gating based on `import.meta.env.PROD`, NOT hostname.
