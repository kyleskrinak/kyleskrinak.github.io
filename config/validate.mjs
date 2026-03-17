#!/usr/bin/env node
/**
 * Validate configuration registry against actual code
 */

import { ConfigRegistry } from './registry.mjs';
import { readFileSync, existsSync } from 'fs';

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

// Validate workflow environment variables
if (existsSync('.github/workflows/staging-deploy.yml')) {
  const stagingWorkflow = readFileSync('.github/workflows/staging-deploy.yml', 'utf-8');
  const stagingDeployEnv = stagingWorkflow.match(/PUBLIC_DEPLOY_ENV:\s*(\w+)/);
  if (!stagingDeployEnv || stagingDeployEnv[1] !== ConfigRegistry.environments['staging-gh'].PUBLIC_DEPLOY_ENV.value) {
    issues.push(`staging-deploy.yml PUBLIC_DEPLOY_ENV mismatch: registry says "${ConfigRegistry.environments['staging-gh'].PUBLIC_DEPLOY_ENV.value}", workflow has "${stagingDeployEnv?.[1] || 'not set'}"`);
  }
}

if (existsSync('.github/workflows/production-deploy.yml')) {
  const prodWorkflow = readFileSync('.github/workflows/production-deploy.yml', 'utf-8');
  const prodDeployEnv = prodWorkflow.match(/PUBLIC_DEPLOY_ENV:\s*(\w+)/);
  if (!prodDeployEnv || prodDeployEnv[1] !== ConfigRegistry.environments['main-aws'].PUBLIC_DEPLOY_ENV.value) {
    issues.push(`production-deploy.yml PUBLIC_DEPLOY_ENV mismatch: registry says "${ConfigRegistry.environments['main-aws'].PUBLIC_DEPLOY_ENV.value}", workflow has "${prodDeployEnv?.[1] || 'not set'}"`);
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
