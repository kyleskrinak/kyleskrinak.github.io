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

const TRACKED_ENV_VARS = ['BUILD_ENV', 'SITE_URL', 'PUBLIC_DEPLOY_ENV', 'PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN'];

function extractEnvVars(workflowContent) {
  const envVars = {};
  const envBlockRegex = /env:\s*\n((?:\s+\w+:.*\n)+)/g;
  const matches = [...workflowContent.matchAll(envBlockRegex)];

  for (const match of matches) {
    const block = match[1];
    for (const varName of TRACKED_ENV_VARS) {
      const varRegex = new RegExp(`${varName}:\\s*(.+)`);
      const varMatch = block.match(varRegex);
      if (varMatch) {
        const rawValue = varMatch[1].trim();
        // Extract actual value, ignoring secrets syntax
        let value = rawValue;
        if (rawValue.includes('secrets.')) {
          value = 'required'; // Secret reference
        }
        envVars[varName] = value;
      }
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
    for (const [varName, actualValue] of Object.entries(actualEnvVars)) {
      const registryVar = registryEnv[varName];
      if (!registryVar) {
        issues.push(`${workflowFile} sets ${varName} but registry environment "${envName}" omits it`);
        continue;
      }

      // For secrets, just check presence; for literals, check exact value
      if (actualValue === 'required' && registryVar.value !== 'required') {
        // Workflow uses secret but registry has literal value - possibly wrong
        continue; // Allow this for now
      } else if (actualValue !== 'required' && actualValue !== registryVar.value) {
        issues.push(`${workflowFile} ${varName} mismatch: registry="${registryVar.value}", workflow="${actualValue}"`);
      }
    }

    // Check: registry vars present in workflow (except import.meta.env.PROD)
    for (const varName of Object.keys(registryEnv)) {
      if (varName === 'import.meta.env.PROD') continue; // Not in workflow env
      if (!actualEnvVars[varName]) {
        issues.push(`Registry environment "${envName}" documents ${varName} but ${workflowFile} doesn't set it`);
      }
    }
  }
}

// Check if docs exist
if (!existsSync('docs/operations/environment-configuration.md')) {
  console.warn('⚠️  Generated docs not found. Run: npm run config:generate');
}

if (issues.length > 0) {
  console.error('❌ Validation failed:\n');
  issues.forEach(issue => console.error(`  - ${issue}`));
  process.exit(1);
}

console.log('✅ Configuration validation passed');
