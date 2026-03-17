#!/usr/bin/env node
/**
 * Generate environment configuration documentation from registry
 */

import { ConfigRegistry } from './registry.mjs';
import { generateEnvironmentMatrix } from './shared.mjs';
import { writeFileSync } from 'fs';

const doc = `# Environment Configuration Reference

> **⚠️ AUTO-GENERATED** from \`config/registry.mjs\`
> Do not edit manually - run \`npm run config:generate\`

## Environment Variable Matrix

${generateEnvironmentMatrix(ConfigRegistry)}

✓ = Required

## Astro Configuration

### base: \`${ConfigRegistry.astro.base.value}\`
- Location: ${ConfigRegistry.astro.base.location}
- Reason: ${ConfigRegistry.astro.base.reason}
- Impacts: ${ConfigRegistry.astro.base.impact.join(', ')}

### trailingSlash: \`${ConfigRegistry.astro.trailingSlash.value}\`
- Location: ${ConfigRegistry.astro.trailingSlash.location}
- Reason: ${ConfigRegistry.astro.trailingSlash.reason}
- Impacts:
${ConfigRegistry.astro.trailingSlash.impact.map(i => `  - ${i}`).join('\n')}

## Analytics Gating

### Cloudflare
- Gating: \`${ConfigRegistry.analytics.cloudflare.gating}\`
- Location: ${ConfigRegistry.analytics.cloudflare.location}
- Test policy: ${ConfigRegistry.analytics.cloudflare.testPolicy}

### Google Analytics
- Gating: \`${ConfigRegistry.analytics.googleAnalytics.gating}\`
- Location: ${ConfigRegistry.analytics.googleAnalytics.location}
- Test policy: ${ConfigRegistry.analytics.googleAnalytics.testPolicy}

**Key:** Analytics gating based on \`import.meta.env.PROD\`, NOT hostname.

## Deployment Infrastructure

### Staging (GitHub Pages)
- Platform: ${ConfigRegistry.deployment['staging-gh'].platform}
- Mechanism: ${ConfigRegistry.deployment['staging-gh'].mechanism}
- Variables: None (uses automatic GITHUB_TOKEN)

### Production (AWS S3 + CloudFront)
- Platform: ${ConfigRegistry.deployment['main-aws'].platform}
- Mechanism: ${ConfigRegistry.deployment['main-aws'].mechanism}
- Variables (GitHub repository vars):
${Object.entries(ConfigRegistry.deployment['main-aws'].variables)
  .map(([name, config]) => `  - \`${name}\`: ${config.source} (used in ${config.location})`)
  .join('\n')}

### PR Visual Check
- Platform: ${ConfigRegistry.deployment['pr-visual-check'].platform}
- Mechanism: ${ConfigRegistry.deployment['pr-visual-check'].mechanism}
- Variables: None (build artifacts only, no deployment)
`;

const outputPath = 'docs/operations/environment-configuration.md';
writeFileSync(outputPath, doc, 'utf-8');
console.log(`✅ Generated ${outputPath}`);
