/**
 * Central Configuration Registry
 *
 * Single source of truth for all configuration values across environments.
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
      SITE_URL: { value: null, source: 'optional', required: false },
      'import.meta.env.PROD': { value: false, source: 'astro-dev', required: false }
    },
    'staging-gh': {
      BUILD_ENV: { value: 'production', source: 'workflow', required: true },
      SITE_URL: { value: 'https://kyleskrinak.github.io/', source: 'workflow', required: true },
      PUBLIC_DEPLOY_ENV: { value: 'staging', source: 'workflow', required: true },
      PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: { value: 'required', source: 'secret', required: true },
      'import.meta.env.PROD': { value: true, source: 'astro-build', required: false }
    },
    'pr-visual-check': {
      BUILD_ENV: { value: 'production', source: 'workflow', required: true },
      SITE_URL: { value: 'https://kyle.skrinak.com/', source: 'workflow', required: true },
      PUBLIC_DEPLOY_ENV: { value: 'production', source: 'workflow', required: true },
      PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: { value: 'required', source: 'secret', required: true },
      PUBLIC_GOOGLE_SITE_VERIFICATION: { value: 'required', source: 'secret', required: false },
      'import.meta.env.PROD': { value: true, source: 'astro-build', required: false }
    },
    'main-aws': {
      BUILD_ENV: { value: 'production', source: 'workflow', required: true },
      SITE_URL: { value: 'https://kyle.skrinak.com/', source: 'workflow', required: true },
      PUBLIC_DEPLOY_ENV: { value: 'production', source: 'workflow', required: true },
      PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN: { value: 'required', source: 'secret', required: true },
      PUBLIC_GOOGLE_SITE_VERIFICATION: { value: 'required', source: 'secret', required: false },
      'import.meta.env.PROD': { value: true, source: 'astro-build', required: false }
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
      gating: 'import.meta.env.PROD',
      location: 'src/components/GoogleAnalytics.astro:7',
      testPolicy: 'Skip on local URLs to avoid prod-build setup',
      testLocation: 'tests/test-utils.ts:isLocalUrl'
    }
  }
};
