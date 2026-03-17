/**
 * Central Configuration Registry
 *
 * Single source of truth for all configuration values across environments.
 *
 * Naming conventions:
 * - environments: Uses Astro env var names (PUBLIC_*, BUILD_ENV, SITE_URL).
 *   These are the names set in workflow `env:` blocks and consumed by Astro.
 * - deployment.variables: Uses GitHub repository variable names (AWS_ACCOUNT_ID, etc.).
 *   These are referenced as `vars.VARIABLE_NAME` in workflow `with:` blocks,
 *   not in `env:` blocks — a different YAML namespace than environment vars.
 *   Secrets (source: 'secret') are referenced as `secrets.NAME` in workflows;
 *   their Astro-side name may differ (e.g., GOOGLE_ANALYTICS_ID secret →
 *   PUBLIC_GOOGLE_ANALYTICS_ID env var).
 * - buildFlags: Astro framework flags set automatically at build time; these
 *   are NOT workflow env vars and cannot be overridden via `env:` blocks.
 */

export const ConfigRegistry = {
  astro: {
    base: {
      value: '/',
      location: 'astro.config.ts:21',
      reason: 'GitHub Pages user site must deploy to root',
      relatedDocs: 'docs/operations/staging-url-reference.md',
      impact: ['All URLs', 'Canonical paths', 'Asset paths']
    },
    trailingSlash: {
      value: 'always',
      location: 'astro.config.ts:26',
      reason: 'Consistency with Jekyll URL structure',
      relatedDocs: 'docs/operations/staging-url-reference.md#url-structure',
      impact: [
        'Canonical URLs must end with /',
        'Redirects preserve trailing slash',
        'Link validation expects trailing /',
        'Test assertions use trailing /'
      ],
      relatedCode: ['src/utils/canonicalizePathname.ts', 'tests/test-utils.ts']
    }
  },

  environments: {
    'local-develop': {
      BUILD_ENV: { value: 'production', source: 'default', required: false },
      SITE_URL: { value: null, source: 'optional', required: false }
    },
    'staging-gh': {
      BUILD_ENV: { value: 'production', source: 'workflow', required: true },
      SITE_URL: { value: 'https://kyleskrinak.github.io/', source: 'workflow', required: true },
      PUBLIC_DEPLOY_ENV: { value: 'staging', source: 'workflow', required: true },
      PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: { value: 'required', source: 'secret', required: true },
      PUBLIC_GOOGLE_ANALYTICS_ID: { value: null, source: 'omitted', required: false },
      PUBLIC_GOOGLE_SITE_VERIFICATION: { value: null, source: 'omitted', required: false }
    },
    'pr-visual-check': {
      BUILD_ENV: { value: 'production', source: 'workflow', required: true },
      SITE_URL: { value: 'https://kyle.skrinak.com/', source: 'workflow', required: true },
      PUBLIC_DEPLOY_ENV: { value: 'production', source: 'workflow', required: true },
      PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: { value: 'required', source: 'secret', required: true },
      PUBLIC_GOOGLE_SITE_VERIFICATION: { value: 'required', source: 'secret', required: true },
      PUBLIC_GOOGLE_ANALYTICS_ID: { value: 'required', source: 'secret', required: true }
    },
    'main-aws': {
      BUILD_ENV: { value: 'production', source: 'workflow', required: true },
      SITE_URL: { value: 'https://kyle.skrinak.com/', source: 'workflow', required: true },
      PUBLIC_DEPLOY_ENV: { value: 'production', source: 'workflow', required: true },
      PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: { value: 'required', source: 'secret', required: true },
      PUBLIC_GOOGLE_SITE_VERIFICATION: { value: 'required', source: 'secret', required: true },
      PUBLIC_GOOGLE_ANALYTICS_ID: { value: 'required', source: 'secret', required: true }
    }
  },

  // Astro framework flags set automatically at build time.
  // NOT workflow env vars — cannot be set or overridden via workflow `env:` blocks.
  buildFlags: {
    'import.meta.env.PROD': {
      'local-develop': false,    // astro dev: always false
      'staging-gh': true,        // astro build: always true
      'pr-visual-check': true,   // astro build: always true
      'main-aws': true           // astro build: always true
    }
  },

  analytics: {
    cloudflare: {
      gating: 'import.meta.env.PROD && PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN',
      location: 'src/layouts/Layout.astro:214',
      testPolicy: 'Skip on local URLs to avoid prod-build setup',
      testLocation: 'tests/test-utils.ts:isLocalUrl'
    },
    googleAnalytics: {
      gating: 'import.meta.env.PROD && PUBLIC_GOOGLE_ANALYTICS_ID',
      location: 'src/components/GoogleAnalytics.astro:6',
      testPolicy: 'Skip on local URLs to avoid prod-build setup',
      testLocation: 'tests/test-utils.ts:isLocalUrl'
    }
  },

  deployment: {
    'staging-gh': {
      platform: 'GitHub Pages',
      mechanism: 'GitHub Actions pages deployment',
      location: '.github/workflows/staging-deploy.yml',
      variables: {
        // GitHub Pages deployment uses GITHUB_TOKEN (automatic) and pages permissions
        // No explicit deployment variables required
      }
    },
    'main-aws': {
      platform: 'AWS S3 + CloudFront',
      mechanism: 'OIDC authentication + AWS CLI',
      location: '.github/workflows/production-deploy.yml',
      variables: {
        AWS_ACCOUNT_ID: { value: 'required', source: 'github-var', location: 'production-deploy.yml:57' },
        AWS_DEPLOY_ROLE: { value: 'required', source: 'github-var', location: 'production-deploy.yml:57' },
        AWS_REGION: { value: 'required', source: 'github-var', location: 'production-deploy.yml:58' },
        AWS_S3_BUCKET: { value: 'required', source: 'github-var', location: 'production-deploy.yml:63,75' },
        AWS_CLOUDFRONT_DISTRIBUTION_ID: { value: 'required', source: 'github-var', location: 'production-deploy.yml:85' }
      }
    },
    'pr-visual-check': {
      platform: 'Local (no deployment)',
      mechanism: 'Build artifacts only',
      location: '.github/workflows/pr-visual-check.yml',
      variables: {}
    }
  }
};
