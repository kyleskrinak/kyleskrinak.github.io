/**
 * Shared utilities for config generation and validation
 */

/**
 * Generate environment variable matrix for documentation.
 * Used by generateDocContent — and therefore by both generate-docs.mjs and
 * validate.mjs — to ensure the generator and validator stay in sync.
 */
export function generateEnvironmentMatrix(ConfigRegistry) {
  const envs = Object.keys(ConfigRegistry.environments);
  const allVars = new Set();

  envs.forEach(env => {
    Object.keys(ConfigRegistry.environments[env]).forEach(v => allVars.add(v));
  });

  const rows = Array.from(allVars).map(varName => {
    const cells = envs.map(env => {
      const config = ConfigRegistry.environments[env][varName];
      if (!config) return '-';
      // Handle null values explicitly
      if (config.value === null) return '(omitted)';
      const required = config.required ? ' ✓' : '';
      return `\`${config.value}\`${required}`;
    });
    return `| \`${varName}\` | ${cells.join(' | ')} |`;
  });

  const headerRow = `| Variable | ${envs.join(' | ')} |`;
  const separatorRow = `|----------|${envs.map(() => '----------').join('|')}|`;

  return `${headerRow}\n${separatorRow}\n${rows.join('\n')}`;
}

/**
 * Generate build flags matrix for documentation.
 */
export function generateBuildFlagsMatrix(ConfigRegistry) {
  const envs = Object.keys(ConfigRegistry.environments);
  const flags = ConfigRegistry.buildFlags;

  const rows = Object.entries(flags).map(([flagName, values]) => {
    const cells = envs.map(env => {
      const v = values[env];
      return v === undefined ? '-' : `\`${v}\``;
    });
    return `| \`${flagName}\` | ${cells.join(' | ')} |`;
  });

  const headerRow = `| Flag | ${envs.join(' | ')} |`;
  const separatorRow = `|------|${envs.map(() => '----------').join('|')}|`;

  return `${headerRow}\n${separatorRow}\n${rows.join('\n')}`;
}

/**
 * Generate the full documentation content from the registry.
 * Called by generate-docs.mjs to write the file, and by validate.mjs to
 * compare against the file on disk. Both use this function so format changes
 * are automatically detected by validation.
 */
export function generateDocContent(ConfigRegistry) {
  return `# Environment Configuration Reference

> **⚠️ AUTO-GENERATED** from \`config/registry.mjs\`
> Do not edit manually - run \`npm run config:generate\`

## Environment Variable Matrix

${generateEnvironmentMatrix(ConfigRegistry)}

✓ = Required

## Build Flags

Astro build flags set automatically by the framework (not configurable via workflow env vars):

${generateBuildFlagsMatrix(ConfigRegistry)}

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
}
