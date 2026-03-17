#!/usr/bin/env node
/**
 * Validate configuration registry against actual code
 */

import { ConfigRegistry } from './registry.mjs';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const issues = [];

// Validate astro.config.ts
if (existsSync('astro.config.ts')) {
  const astroConfig = readFileSync('astro.config.ts', 'utf-8');

  const baseMatch = astroConfig.match(/const base = ["']([^"']+)["']/);
  if (baseMatch && baseMatch[1] !== ConfigRegistry.astro.base.value) {
    issues.push(`base mismatch: registry says "${ConfigRegistry.astro.base.value}", code has "${baseMatch[1]}"`);
  }

  const trailingSlashMatch = astroConfig.match(/trailingSlash:\s*["'](\w+)["']/);
  if (trailingSlashMatch && trailingSlashMatch[1] !== ConfigRegistry.astro.trailingSlash.value) {
    issues.push(`trailingSlash mismatch: registry says "${ConfigRegistry.astro.trailingSlash.value}", code has "${trailingSlashMatch[1]}"`);
  }
}

// Validate analytics gating
if (existsSync('src/layouts/Layout.astro')) {
  const layout = readFileSync('src/layouts/Layout.astro', 'utf-8');
  if (!layout.includes('import.meta.env.PROD && PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN')) {
    issues.push('Cloudflare analytics gating mismatch');
  }
}

if (existsSync('src/components/GoogleAnalytics.astro')) {
  const ga = readFileSync('src/components/GoogleAnalytics.astro', 'utf-8');
  if (!ga.includes('import.meta.env.PROD')) {
    issues.push('GA analytics gating mismatch');
  }
}

// Comprehensive workflow validation
const WORKFLOW_TO_ENV_MAP = {
  'staging-deploy.yml': 'staging-gh',
  'production-deploy.yml': 'main-aws',
  'pr-visual-check.yml': 'pr-visual-check'
};

function extractEnvVars(workflowContent) {
  const envVars = {};
  const envBlockRegex = /env:\s*\n((?:\s+\w+:.*\n)+)/g;
  const matches = [...workflowContent.matchAll(envBlockRegex)];

  for (const match of matches) {
    const block = match[1];
    // Extract ALL env vars from the block, not just a hardcoded list
    const varRegex = /^\s+(\w+):\s*(.+)$/gm;
    let varMatch;

    while ((varMatch = varRegex.exec(block)) !== null) {
      const varName = varMatch[1];
      const rawValue = varMatch[2].trim();

      // Extract actual value, ignoring secrets syntax
      let value = rawValue;
      if (rawValue.includes('secrets.')) {
        value = 'required'; // Secret reference
      }

      envVars[varName] = value;
    }
  }
  return envVars;
}

// Scan all workflow files
const workflowDir = '.github/workflows';
if (existsSync(workflowDir)) {
  const workflowFiles = readdirSync(workflowDir).filter(f => f.endsWith('.yml'));

  for (const workflowFile of workflowFiles) {
    const envName = WORKFLOW_TO_ENV_MAP[workflowFile];
    if (!envName) continue; // Skip unmapped workflows

    const workflowPath = join(workflowDir, workflowFile);
    const workflowContent = readFileSync(workflowPath, 'utf-8');
    const actualEnvVars = extractEnvVars(workflowContent);

    const registryEnv = ConfigRegistry.environments[envName];
    if (!registryEnv) {
      issues.push(`Workflow ${workflowFile} maps to environment "${envName}" but registry has no such environment`);
      continue;
    }

    // Check: workflow vars present in registry
    // Exempt test-tool variables (not part of app runtime config)
    const testToolVars = new Set(['PLAYWRIGHT_TEST_BASE_URL']);

    for (const [varName, actualValue] of Object.entries(actualEnvVars)) {
      // Skip test-tool variables
      if (testToolVars.has(varName)) continue;

      const registryVar = registryEnv[varName];
      if (!registryVar) {
        issues.push(`${workflowFile} sets ${varName} but registry environment "${envName}" omits it`);
        continue;
      }

      // Validate value consistency: registry and workflow must match
      if (actualValue !== registryVar.value) {
        issues.push(`${workflowFile} ${varName} mismatch: registry="${registryVar.value}", workflow="${actualValue}"`);
      }
    }

    // Check: registry vars present in workflow (except import.meta.env.PROD and optional vars)
    for (const varName of Object.keys(registryEnv)) {
      if (varName === 'import.meta.env.PROD') continue; // Not in workflow env
      const registryVar = registryEnv[varName];
      if (registryVar.required === false) continue; // Optional vars may not be in workflow
      if (!actualEnvVars[varName]) {
        issues.push(`Registry environment "${envName}" documents ${varName} but ${workflowFile} doesn't set it`);
      }
    }

    // Validate deployment variables (GitHub vars.*)
    if (ConfigRegistry.deployment && ConfigRegistry.deployment[envName]) {
      const deploymentConfig = ConfigRegistry.deployment[envName];
      const registryDeployVars = deploymentConfig.variables || {};

      // Extract GitHub variables from workflow content (vars.VARIABLE_NAME)
      const githubVarRegex = /vars\.(\w+)/g;
      const actualDeployVars = new Set();
      let deployMatch;

      while ((deployMatch = githubVarRegex.exec(workflowContent)) !== null) {
        actualDeployVars.add(deployMatch[1]);
      }

      // Check: workflow deployment vars present in registry
      for (const varName of actualDeployVars) {
        if (!registryDeployVars[varName]) {
          issues.push(`${workflowFile} uses vars.${varName} but registry deployment "${envName}" doesn't document it`);
        }
      }

      // Check: registry deployment vars present in workflow
      for (const varName of Object.keys(registryDeployVars)) {
        if (!actualDeployVars.has(varName)) {
          issues.push(`Registry deployment "${envName}" documents ${varName} but ${workflowFile} doesn't use it`);
        }
      }
    }
  }
}

// Validate astro.config.ts env schema coverage
if (existsSync('astro.config.ts')) {
  const astroConfig = readFileSync('astro.config.ts', 'utf-8');

  // Extract env schema variable names - look for pattern "varName: envField"
  const varNameRegex = /(\w+):\s*envField/g;
  const envVars = [];
  let match;

  while ((match = varNameRegex.exec(astroConfig)) !== null) {
    envVars.push(match[1]);
  }

  // Check each env schema var is documented in at least one registry environment
  for (const varName of envVars) {
    let foundInRegistry = false;

    for (const envName of Object.keys(ConfigRegistry.environments)) {
      if (ConfigRegistry.environments[envName][varName]) {
        foundInRegistry = true;
        break;
      }
    }

    if (!foundInRegistry) {
      issues.push(`astro.config.ts env schema declares ${varName} but it's not documented in any registry environment`);
    }
  }
}

// Validate process.env usage against env schema
const processEnvUsageFiles = [
  'src/config/index.ts',
  'astro.config.ts',
];

// Get env vars declared in astro.config.ts env schema
const envSchemaVars = new Set();
if (existsSync('astro.config.ts')) {
  const astroConfig = readFileSync('astro.config.ts', 'utf-8');
  const varNameRegex = /(\w+):\s*envField/g;
  let match;

  while ((match = varNameRegex.exec(astroConfig)) !== null) {
    envSchemaVars.add(match[1]);
  }
}

// Known system env vars that don't need to be in schema
const systemEnvVars = new Set([
  'NODE_ENV',
  'DISABLE_DEV_TOOLBAR', // Dev-only toggle
]);

for (const filePath of processEnvUsageFiles) {
  if (!existsSync(filePath)) continue;

  const content = readFileSync(filePath, 'utf-8');
  const processEnvRegex = /process\.env\.(\w+)/g;
  let match;

  while ((match = processEnvRegex.exec(content)) !== null) {
    const varName = match[1];

    // Skip if it's a system var or already in env schema
    if (systemEnvVars.has(varName) || envSchemaVars.has(varName)) {
      continue;
    }

    issues.push(`${filePath} uses process.env.${varName} but it's not declared in astro.config.ts env schema`);
  }
}

// Validate hardcoded literal values in src/config/index.ts against registry
if (existsSync('src/config/index.ts')) {
  const configContent = readFileSync('src/config/index.ts', 'utf-8');

  // Extract hardcoded URLs from fallback logic
  const prodUrlMatch = configContent.match(/isProduction \? "([^"]+)"/);
  const stagingUrlMatch = configContent.match(/: "([^"]+)"\)/);
  const buildEnvDefaultMatch = configContent.match(/process\.env\.BUILD_ENV \|\| "([^"]+)"/);

  if (prodUrlMatch) {
    const hardcodedProdUrl = prodUrlMatch[1];
    const registryProdUrl = ConfigRegistry.environments['main-aws'].SITE_URL.value;
    if (hardcodedProdUrl !== registryProdUrl) {
      issues.push(`src/config/index.ts production URL "${hardcodedProdUrl}" doesn't match registry "${registryProdUrl}"`);
    }
  }

  if (stagingUrlMatch) {
    const hardcodedStagingUrl = stagingUrlMatch[1];
    const registryStagingUrl = ConfigRegistry.environments['staging-gh'].SITE_URL.value;
    if (hardcodedStagingUrl !== registryStagingUrl) {
      issues.push(`src/config/index.ts staging URL "${hardcodedStagingUrl}" doesn't match registry "${registryStagingUrl}"`);
    }
  }

  if (buildEnvDefaultMatch) {
    const hardcodedDefault = buildEnvDefaultMatch[1];
    // BUILD_ENV default should match astro.config.ts env schema default
    // The schema default is "production" so we validate against that
    if (hardcodedDefault !== 'production') {
      issues.push(`src/config/index.ts BUILD_ENV default "${hardcodedDefault}" should be "production"`);
    }
  }
}

// Validate generated docs are up to date
const docsPath = 'docs/operations/environment-configuration.md';
if (!existsSync(docsPath)) {
  issues.push('Generated docs not found. Run: npm run config:generate');
} else {
  // Generate expected doc content (matching generate-docs.mjs logic)
  function generateEnvironmentMatrix() {
    const envs = Object.keys(ConfigRegistry.environments);
    const allVars = new Set();

    envs.forEach(env => {
      Object.keys(ConfigRegistry.environments[env]).forEach(v => allVars.add(v));
    });

    const rows = Array.from(allVars).map(varName => {
      const cells = envs.map(env => {
        const config = ConfigRegistry.environments[env][varName];
        if (!config) return '-';
        const required = config.required ? ' ✓' : '';
        return `\`${config.value}\`${required}`;
      });
      return `| \`${varName}\` | ${cells.join(' | ')} |`;
    });

    const headerRow = `| Variable | ${envs.join(' | ')} |`;
    const separatorRow = `|----------|${envs.map(() => '----------').join('|')}|`;

    return `${headerRow}\n${separatorRow}\n${rows.join('\n')}`;
  }

  const expectedDoc = `# Environment Configuration Reference

> **⚠️ AUTO-GENERATED** from \`config/registry.mjs\`
> Do not edit manually - run \`npm run config:generate\`

## Environment Variable Matrix

${generateEnvironmentMatrix()}

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

  const actualDoc = readFileSync(docsPath, 'utf-8');

  if (actualDoc !== expectedDoc) {
    issues.push('Generated docs are out of date. Run: npm run config:generate');
  }
}

if (issues.length > 0) {
  console.error('❌ Validation failed:\n');
  issues.forEach(issue => console.error(`  - ${issue}`));
  process.exit(1);
}

console.log('✅ Configuration validation passed');
