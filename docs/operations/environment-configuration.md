# Environment Configuration Reference

> **⚠️ AUTO-GENERATED** from `config/registry.mjs`
>
> Last generated: 2026-03-17T14:07:52.047Z

## Environment Variable Matrix

| Variable | local-develop | staging-gh | main-aws |
|----------|----------|----------|----------|
| `BUILD_ENV` | `production` | `production` ✓ | `production` ✓ |
| `SITE_URL` | `null` | `https://kyleskrinak.github.io/` ✓ | `https://kyle.skrinak.com/` ✓ |
| `import.meta.env.PROD` | `false` | `true` | `true` |
| `PUBLIC_DEPLOY_ENV` | - | `staging` ✓ | `production` ✓ |
| `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` | - | - | `required` ✓ |

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
