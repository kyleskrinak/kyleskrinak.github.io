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

console.log('\n🚩 BUILD FLAGS');
console.log('─'.repeat(60));
Object.entries(ConfigRegistry.buildFlags).forEach(([flag, values]) => {
  console.log(`\n${flag}:`);
  Object.entries(values).forEach(([env, value]) => {
    console.log(`  ${env}: ${value}`);
  });
});

console.log('\n📊 ANALYTICS');
console.log('─'.repeat(60));
console.log(`\nCloudflare: ${ConfigRegistry.analytics.cloudflare.gating}`);
console.log(`GA: ${ConfigRegistry.analytics.googleAnalytics.gating}`);
console.log(`GSV: ${ConfigRegistry.analytics.googleSiteVerification.gating}`);

console.log('\n🔧 CURRENT PROCESS ENV');
console.log('─'.repeat(60));

const allVarNames = new Set();
const secretVarNames = new Set();
Object.values(ConfigRegistry.environments).forEach(env => {
  Object.entries(env).forEach(([key, config]) => {
    allVarNames.add(key);
    if (config.source === 'secret') secretVarNames.add(key);
  });
});
for (const varName of [...allVarNames].sort()) {
  const raw = process.env[varName];
  if (raw === undefined) {
    console.log(`${varName}: (not set)`);
  } else if (secretVarNames.has(varName)) {
    console.log(`${varName}: (set, masked)`);
  } else {
    console.log(`${varName}: ${raw}`);
  }
}

console.log('\n' + '═'.repeat(60));
console.log('\n💡 Tip: Run "npm run config:validate" to check for drift\n');
