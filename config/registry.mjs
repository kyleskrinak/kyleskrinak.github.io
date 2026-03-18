/**
 * Central Configuration Registry
 *
 * Single source of truth for all configuration values across environments.
 *
 * Scope: This registry covers deployment/environment configuration —
 * env vars, build flags, analytics gating, and deployment settings that
 * vary across environments. `src/config/index.ts` also exports static site
 * content (author, title, ogImage, social links, etc.) that is intentionally
 * out of scope here — those values don't vary by environment and don't need
 * registry tracking.
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
 *
 * Source field values (where configuration values come from):
 * - 'workflow': Set explicitly in workflow env blocks (required in CI)
 * - 'secret': Pulled from GitHub secrets (sensitive values, required in CI)
 * - 'github-var': GitHub repository variables (vars.VARIABLE_NAME in workflows)
 * - 'default': Defined by env schema default (astro.config.ts), always available
 * - 'optional': Can be set explicitly; when absent another var provides the value
 * - 'fallback': Not set as env var; effective value comes from code fallback logic
 * - 'omitted': Not set in this environment (value: null, not used)
 */

// NOTE: `location` fields specify files where config values are used.
// Line numbers are omitted because they drift after refactors and become
// misleading. The gating expression validation ensures correctness.

export const ConfigRegistry = {
  astro: {
    base: {
      value: '/',
      location: 'astro.config.ts',
      reason: 'GitHub Pages user site must deploy to root',
      relatedDocs: 'docs/operations/staging-url-reference.md',
      impact: ['All URLs', 'Canonical paths', 'Asset paths']
    },
    trailingSlash: {
      value: 'always',
      location: 'astro.config.ts',
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
      SITE_URL: {
        value: 'https://kyle.skrinak.com/',
        source: 'fallback',
        required: false,
        notes: 'Not set as env var; src/config/index.ts falls back to production URL. Set SITE_URL explicitly to override.'
      },
      PUBLIC_DEPLOY_ENV: {
        value: 'production',
        source: 'fallback',
        required: false,
        notes: 'Not set as env var; Layout.astro and robots.txt.ts fall back to "production" when absent (no staging banner, indexing allowed).'
      },
      PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: {
        value: null,
        source: 'omitted',
        required: false,
        notes: 'Gated on import.meta.env.PROD — never loads in local dev builds.'
      },
      PUBLIC_GOOGLE_ANALYTICS_ID: {
        value: null,
        source: 'omitted',
        required: false,
        notes: 'Gated on import.meta.env.PROD — never loads in local dev builds.'
      },
      PUBLIC_GOOGLE_SITE_VERIFICATION: {
        value: null,
        source: 'omitted',
        required: false,
        notes: 'Gated on import.meta.env.PROD — never renders in local dev builds.'
      }
    },
    'staging-gh': {
      BUILD_ENV: { value: 'production', source: 'workflow', required: true },
      SITE_URL: { value: 'https://kyleskrinak.github.io/', source: 'workflow', required: true },
      PUBLIC_DEPLOY_ENV: { value: 'staging', source: 'workflow', required: true },
      PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: { value: 'required', source: 'secret', required: true },
      PUBLIC_GOOGLE_ANALYTICS_ID: { value: null, source: 'omitted', required: false, notes: 'Staging omitted - no analytics tracking needed for preview builds' },
      PUBLIC_GOOGLE_SITE_VERIFICATION: { value: null, source: 'omitted', required: false, notes: 'Staging omitted - no search engine verification needed for deindexed preview builds' }
    },
    'pr-visual-check': {
      // PR visual checks build with production settings to generate accurate baseline screenshots.
      // Analytics secrets are required because Layout.astro/GoogleAnalytics.astro render conditionally
      // on these values, affecting visual output. Using production URL and deploy env ensures
      // screenshots match what will be deployed after merge.
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
      location: 'src/layouts/Layout.astro',
      testPolicy: 'Skip on local URLs to avoid prod-build setup',
      testLocation: 'tests/test-utils.ts (isLocalUrl)'
    },
    googleAnalytics: {
      gating: 'import.meta.env.PROD && PUBLIC_GOOGLE_ANALYTICS_ID',
      location: 'src/components/GoogleAnalytics.astro',
      testPolicy: 'Skip on local URLs to avoid prod-build setup',
      testLocation: 'tests/test-utils.ts (isLocalUrl)'
    },
    googleSiteVerification: {
      gating: 'import.meta.env.PROD && PUBLIC_GOOGLE_SITE_VERIFICATION',
      location: 'src/layouts/Layout.astro',
      testPolicy: 'Not tested separately; gating covered by prod-build rule',
      testLocation: null
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
        AWS_ACCOUNT_ID: { value: 'required', source: 'github-var', location: '.github/workflows/production-deploy.yml' },
        AWS_DEPLOY_ROLE: { value: 'required', source: 'github-var', location: '.github/workflows/production-deploy.yml' },
        AWS_REGION: { value: 'required', source: 'github-var', location: '.github/workflows/production-deploy.yml' },
        AWS_S3_BUCKET: { value: 'required', source: 'github-var', location: '.github/workflows/production-deploy.yml' },
        AWS_CLOUDFRONT_DISTRIBUTION_ID: { value: 'required', source: 'github-var', location: '.github/workflows/production-deploy.yml' }
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
