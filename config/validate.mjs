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
