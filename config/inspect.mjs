#!/usr/bin/env node
/**
 * Inspect current configuration
 */

import { ConfigRegistry } from './registry.mjs';

console.log('\n🔍 Configuration Inspector\n');
console.log('═'.repeat(60));

console.log('\n📋 ASTRO CONFIGURATION');
console.log('─'.repeat(60));
console.log(`base: "${ConfigRegistry.astro.base.value}"`);
console.log(`  ${ConfigRegistry.astro.base.reason}\n`);

console.log(`trailingSlash: "${ConfigRegistry.astro.trailingSlash.value}"`);
console.log(`  ${ConfigRegistry.astro.trailingSlash.reason}`);
console.log(`  Impacts:`);
ConfigRegistry.astro.trailingSlash.impact.forEach(i => console.log(`    - ${i}`));

console.log('\n🌍 ENVIRONMENTS');
console.log('─'.repeat(60));

Object.entries(ConfigRegistry.environments).forEach(([env, vars]) => {
  console.log(`\n${env}:`);
  Object.entries(vars).forEach(([key, config]) => {
    const req = config.required ? ' [REQUIRED]' : '';
    console.log(`  ${key}: ${config.value}${req}`);
  });
});

console.log('\n📊 ANALYTICS');
console.log('─'.repeat(60));
console.log(`\nCloudflare: ${ConfigRegistry.analytics.cloudflare.gating}`);
console.log(`GA: ${ConfigRegistry.analytics.googleAnalytics.gating}`);

console.log('\n🔧 CURRENT PROCESS ENV');
console.log('─'.repeat(60));
console.log(`BUILD_ENV: ${process.env.BUILD_ENV || '(not set)'}`);
console.log(`SITE_URL: ${process.env.SITE_URL || '(not set)'}`);
console.log(`PUBLIC_DEPLOY_ENV: ${process.env.PUBLIC_DEPLOY_ENV || '(not set)'}`);

console.log('\n═'.repeat(60));
console.log('\n💡 Tip: Run "npm run config:validate" to check for drift\n');
