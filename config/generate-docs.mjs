#!/usr/bin/env node
/**
 * Generate environment configuration documentation from registry
 */

import { ConfigRegistry } from './registry.mjs';
import { generateDocContent } from './shared.mjs';
import { writeFileSync } from 'fs';

const outputPath = 'docs/operations/environment-configuration.md';
writeFileSync(outputPath, generateDocContent(ConfigRegistry), 'utf-8');
console.log(`✅ Generated ${outputPath}`);
