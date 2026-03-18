#!/usr/bin/env node
/**
 * Validate configuration registry against actual code
 */

import { ConfigRegistry } from './registry.mjs';
import { generateDocContent } from './shared.mjs';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

const issues = [];

// Expected default for BUILD_ENV — derived from registry local-develop environment.
// local-develop has no workflow, so its BUILD_ENV value is the schema default.
// Optional chaining + hardcoded fallback: if the registry path is deleted/renamed,
// the module still loads and validation reports a mismatch rather than crashing.
const BUILD_ENV_DEFAULT = ConfigRegistry.environments?.['local-develop']?.BUILD_ENV?.value ?? 'production';

// Expected default for PUBLIC_DEPLOY_ENV fallbacks — derived from registry main-aws environment.
// main-aws is the anchor because PUBLIC_DEPLOY_ENV fallbacks in robots.txt.ts and Layout.astro
// produce production behavior when the var is absent (no staging banner, indexing allowed).
// Semantically distinct from BUILD_ENV_DEFAULT: these are deploy-environment indicators,
// not build-environment selectors. Values happen to match today but may diverge independently.
// Optional chaining + hardcoded fallback: guards against registry path deletion at load time.
const DEPLOY_ENV_DEFAULT = ConfigRegistry.environments?.['main-aws']?.PUBLIC_DEPLOY_ENV?.value ?? 'production';

// Read astro.config.ts once at top (used in multiple validations)
const astroConfigContent = existsSync('astro.config.ts')
  ? readFileSync('astro.config.ts', 'utf-8')
  : null;

// Extract env schema variable names once (used in multiple validations)
// Look for pattern "varName: envField" in astro.config.ts
const envSchemaVars = new Set();
if (astroConfigContent) {
  const varNameRegex = /(\w+):\s*envField/g;
  let match;

  while ((match = varNameRegex.exec(astroConfigContent)) !== null) {
    envSchemaVars.add(match[1]);
  }
}

// Validate astro.config.ts
if (astroConfigContent) {
  const astroConfig = astroConfigContent;

  const baseMatch = astroConfig.match(/const base = ["']([^"']+)["']/);
  if (baseMatch === null) {
    issues.push('Failed to extract base from astro.config.ts - config format may have changed');
  } else if (baseMatch[1] !== ConfigRegistry.astro.base.value) {
    issues.push(`base mismatch: registry says "${ConfigRegistry.astro.base.value}", code has "${baseMatch[1]}"`);
  }

  const trailingSlashMatch = astroConfig.match(/trailingSlash:\s*["'](\w+)["']/);
  if (trailingSlashMatch === null) {
    issues.push('Failed to extract trailingSlash from astro.config.ts - config format may have changed');
  } else if (trailingSlashMatch[1] !== ConfigRegistry.astro.trailingSlash.value) {
    issues.push(`trailingSlash mismatch: registry says "${ConfigRegistry.astro.trailingSlash.value}", code has "${trailingSlashMatch[1]}"`);
  }
}

/**
 * Strip comments from content to avoid false-positive substring matches.
 * Uses negative lookbehind to avoid matching :// in URLs (https://, http://).
 */
function stripComments(content) {
  return content
    .replace(/\/\*.*?\*\//gs, '')  // Strip multi-line block comments first (dotAll flag for newlines)
    .split('\n')
    .map(line => line.replace(/(?<!:)\/\/.*$/, ''))  // Then strip single-line comments
    .join('\n');
}

/**
 * Normalize whitespace for semantic comparison.
 * Collapses all whitespace sequences (including line breaks) to a single space
 * so harmless formatting changes (extra spaces, line breaks) don't fail validation.
 */
function normalizeWhitespace(str) {
  return str.replace(/\s+/g, ' ').trim();
}

// Validate analytics gating
if (existsSync('src/layouts/Layout.astro')) {
  const layout = readFileSync('src/layouts/Layout.astro', 'utf-8');
  const layoutWithoutComments = stripComments(layout);

  const expectedCloudflareGating = ConfigRegistry.analytics.cloudflare.gating;
  if (!normalizeWhitespace(layoutWithoutComments).includes(normalizeWhitespace(expectedCloudflareGating))) {
    issues.push(`Cloudflare analytics gating mismatch: expected "${expectedCloudflareGating}" in Layout.astro`);
  }

  const expectedGsvGating = ConfigRegistry.analytics.googleSiteVerification.gating;
  if (!normalizeWhitespace(layoutWithoutComments).includes(normalizeWhitespace(expectedGsvGating))) {
    issues.push(`GSV gating mismatch: expected "${expectedGsvGating}" in Layout.astro`);
  }
}

if (existsSync('src/components/GoogleAnalytics.astro')) {
  const ga = readFileSync('src/components/GoogleAnalytics.astro', 'utf-8');
  const gaWithoutComments = stripComments(ga);
  const expectedGating = ConfigRegistry.analytics.googleAnalytics.gating;
  if (!normalizeWhitespace(gaWithoutComments).includes(normalizeWhitespace(expectedGating))) {
    issues.push(`GA analytics gating mismatch: expected "${expectedGating}" in GoogleAnalytics.astro`);
  }
}

// Comprehensive workflow validation
// WORKFLOW_TO_ENV_MAP includes only workflows that run 'npm run build:ci'.
// Excluded workflows (linkwatch.yml, pr-visual-comment.yml, secrets-check.yml)
// are intentionally skipped because they don't perform builds.
const WORKFLOW_TO_ENV_MAP = {
  'staging-deploy.yml': 'staging-gh',
  'production-deploy.yml': 'main-aws',
  'pr-visual-check.yml': 'pr-visual-check'
};

// Extracts env vars from the step that runs 'npm run build:ci'.
// This is more robust than matching step names, which can change during refactoring.
// If the build command changes, this function returns { found: false } with diagnostics.
function extractEnvVars(workflowContent) {
  const workflow = parseYaml(workflowContent);

  for (const job of Object.values(workflow.jobs || {})) {
    for (const step of (job.steps || [])) {
      if (step.run && step.run.includes('npm run build:ci') && step.env) {
        const envVars = {};
        for (const [key, value] of Object.entries(step.env)) {
          const raw = String(value);
          const secretMatch = raw.match(/\$\{\{\s*secrets\.(\w+)\s*\}\}/);
          const varMatch = raw.match(/\$\{\{\s*vars\.(\w+)\s*\}\}/);
          if (secretMatch) {
            envVars[key] = { refType: 'secret', refName: secretMatch[1] };
          } else if (varMatch) {
            envVars[key] = { refType: 'var', refName: varMatch[1] };
          } else {
            envVars[key] = raw;
          }
        }
        return { found: true, envVars };
      }
    }
  }

  // No matching step found — collect step names and run commands for diagnostics
  const stepInfo = [];
  for (const job of Object.values(workflow.jobs || {})) {
    for (const step of (job.steps || [])) {
      const info = [];
      if (step.name) info.push(`name: "${step.name}"`);
      if (step.run) {
        const firstLine = step.run.split('\n')[0];
        const suffix = step.run.includes('\n') ? '...' : '';
        info.push(`run: "${firstLine}${suffix}"`);
      }
      if (info.length > 0) stepInfo.push(info.join(', '));
    }
  }
  return { found: false, stepInfo };
}

// Scan all workflow files
const workflowDir = '.github/workflows';
if (existsSync(workflowDir)) {
  const workflowFiles = readdirSync(workflowDir).filter(f => f.endsWith('.yml'));

  for (const workflowFile of workflowFiles) {
    const envName = WORKFLOW_TO_ENV_MAP[workflowFile];
    if (!envName) {
      console.log(`ℹ️  Skipping unmapped workflow: ${workflowFile} (not in WORKFLOW_TO_ENV_MAP)`);
      continue;
    }

    const workflowPath = join(workflowDir, workflowFile);
    const workflowContent = readFileSync(workflowPath, 'utf-8');
    const { found, envVars: actualEnvVars, stepInfo } = extractEnvVars(workflowContent);
    if (!found) {
      issues.push(`${workflowFile}: no step with 'npm run build:ci' found. Available steps: ${stepInfo.join('; ')}`);
      continue;
    }

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

      // Validate value consistency: registry and workflow must match
      if (typeof actualValue === 'object') {
        // Secret or var reference — validate source type alignment to catch miswiring
        // (e.g., using vars.* where secrets.* is expected, or referencing the wrong namespace)
        const expectedRefType = registryVar.source === 'secret' ? 'secret'
          : registryVar.source === 'github-var' ? 'var'
          : null;
        const refDisplay = actualValue.refType === 'secret'
          ? `secrets.${actualValue.refName}`
          : `vars.${actualValue.refName}`;
        if (expectedRefType && actualValue.refType !== expectedRefType) {
          issues.push(`${workflowFile} ${varName}: registry source is '${registryVar.source}' but workflow uses ${refDisplay}`);
        } else if (registryVar.value !== 'required') {
          issues.push(`${workflowFile} ${varName}: registry has literal value "${registryVar.value}" but workflow uses ${refDisplay}`);
        }
      } else {
        if (actualValue !== registryVar.value) {
          issues.push(`${workflowFile} ${varName} mismatch: registry="${registryVar.value}", workflow="${actualValue}"`);
        }
      }
    }

    // Check: registry vars present in workflow (except optional vars).
    // import.meta.env.PROD is in buildFlags (not environments), so no special-case needed.
    for (const varName of Object.keys(registryEnv)) {
      const registryVar = registryEnv[varName];
      if (registryVar.required === false) continue; // Optional vars may not be in workflow
      if (!Object.hasOwn(actualEnvVars, varName)) {
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

// Verify all WORKFLOW_TO_ENV_MAP entries exist on disk.
// If a workflow is renamed, its map entry silently becomes unreachable —
// the environment is no longer validated and drift goes undetected.
if (existsSync(workflowDir)) {
  for (const workflowFile of Object.keys(WORKFLOW_TO_ENV_MAP)) {
    if (!existsSync(join(workflowDir, workflowFile))) {
      issues.push(`WORKFLOW_TO_ENV_MAP references "${workflowFile}" but it doesn't exist in ${workflowDir} — update or remove the map entry`);
    }
  }
}

// Validate astro.config.ts env schema coverage
// Check each env schema var is documented in at least one registry environment
for (const varName of envSchemaVars) {
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

/**
 * Recursively find files matching extensions
 */
function findFiles(dir, extensions, results = []) {
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, dist, etc.
      if (!['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) {
        findFiles(fullPath, extensions, results);
      }
    } else if (entry.isFile()) {
      const ext = entry.name.split('.').pop();
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// Validate process.env usage against env schema
// Build-time env vars that MUST be in env schema (envSchemaVars)
// (used in src/ code that runs during Astro build)

// Env vars allowed outside astro.config.ts env schema.
// Add here when: (1) only used in scripts/ or tests/, (2) a well-known platform var
// (NODE_ENV, CI, DISPLAY), or (3) a dev-tool toggle irrelevant to Astro builds.
// Do NOT add Astro build vars here — declare those in astro.config.ts env schema instead.
const testEnvVars = new Set([
  'NODE_ENV',
  'DISABLE_DEV_TOOLBAR',           // Astro dev toolbar toggle
  'PLAYWRIGHT_IGNORE_HTTPS_ERRORS', // scripts/check-links.js
  'PLAYWRIGHT_HEADED',              // scripts/lib/browser-mode.js
  'PLAYWRIGHT_TEST_BASE_URL',       // tests/ (analytics test gating)
  'CI',                             // CI detection (scripts/lib/browser-mode.js)
  'DISPLAY',                        // X11 display (scripts/lib/browser-mode.js)
  'WAYLAND_DISPLAY',                // Wayland display (scripts/lib/browser-mode.js)
]);

// Scan all TypeScript/JavaScript files in src/ and scripts/
const srcFiles = findFiles('src', ['ts', 'astro', 'js', 'mjs']);
const scriptFiles = findFiles('scripts', ['js', 'mjs']);
const allFiles = [...srcFiles, ...scriptFiles];

for (const filePath of allFiles) {
  const content = readFileSync(filePath, 'utf-8');
  const processEnvRegex = /process\.env\.(\w+)/g;
  let match;

  while ((match = processEnvRegex.exec(content)) !== null) {
    const varName = match[1];

    // Files in src/ must use only env schema vars — testEnvVars (dev-tool/test-only)
    // are not permitted in src/ production code. Declare build-time vars in astro.config.ts.
    if (filePath.startsWith('src/')) {
      if (!envSchemaVars.has(varName)) {
        issues.push(`${filePath} uses process.env.${varName} but it's not declared in astro.config.ts env schema (testEnvVars are not permitted in src/)`);
      }
    }
    // Files in scripts/ can use test vars too
    else if (filePath.startsWith('scripts/')) {
      if (!envSchemaVars.has(varName) && !testEnvVars.has(varName)) {
        issues.push(`${filePath} uses process.env.${varName} but it's not in env schema or testEnvVars allowlist`);
      }
    }
  }
}

// Validate that files use astro:env imports instead of import.meta.env
// Two-tier approach: strict checks on critical files + comprehensive scan for all files
//
// NOTE: src/config/index.ts is exempt from this check because it uses process.env
// for build-time fallback logic that runs before Astro env is available.
// See the hardcoded fallback validation section below and CLAUDE.md for design rationale.

// Tier 1: Critical files must use astro:env imports (strict validation)
const criticalAstroEnvFiles = [
  'src/pages/robots.txt.ts',
  'src/layouts/Layout.astro',
  'src/components/GoogleAnalytics.astro'
];
for (const file of criticalAstroEnvFiles) {
  if (!existsSync(file)) continue;
  const content = readFileSync(file, 'utf-8');

  // Check for old pattern (import.meta.env.PUBLIC_*)
  const hasOldPattern = content.includes('import.meta.env.PUBLIC_');

  // Check for correct pattern (import from "astro:env/client")
  const hasCorrectImport = content.includes('from "astro:env/client"') || content.includes("from 'astro:env/client'");

  // Only flag if file uses PUBLIC_ vars but doesn't use astro:env
  if (hasOldPattern) {
    issues.push(`${file} uses import.meta.env.PUBLIC_* instead of astro:env/client`);
  } else if (!hasCorrectImport && /PUBLIC_\w+/.test(content)) {
    // File references PUBLIC_ vars but has no astro:env import
    issues.push(`${file} should import from "astro:env/client" for PUBLIC_ env vars`);
  }
}

// Tier 2: Comprehensive scan for any files using old pattern (catches stragglers)
const allSourceFiles = [
  ...findFiles('src/pages', ['ts', 'astro']),
  ...findFiles('src/layouts', ['ts', 'astro']),
  ...findFiles('src/components', ['ts', 'astro']),
  ...findFiles('src/config', ['ts', 'astro'])
];

for (const file of allSourceFiles) {
  // Skip files already checked in tier 1
  if (criticalAstroEnvFiles.includes(file)) continue;
  // src/config/index.ts uses process.env by design — it runs at build initialization
  // before Astro env is available. See CLAUDE.md and the hardcoded fallback section below.
  if (file === 'src/config/index.ts') continue;

  const content = readFileSync(file, 'utf-8');

  // Flag any usage of import.meta.env.PUBLIC_* (should migrate to astro:env)
  if (content.includes('import.meta.env.PUBLIC_')) {
    issues.push(`${file} uses import.meta.env.PUBLIC_* instead of astro:env/client (new file not in critical list)`);
  }
}

// Validate hardcoded fallback URL in src/config/index.ts against registry
//
// Design decision: src/config/index.ts uses process.env with a hardcoded production URL fallback
// instead of astro:env because it runs at build initialization before Astro env is fully available.
// All workflows set SITE_URL explicitly, so the fallback only applies in local dev.
// We validate the literal against the registry to prevent drift.
if (existsSync('src/config/index.ts')) {
  const configContent = readFileSync('src/config/index.ts', 'utf-8');

  // Loose regex: tolerates variable renames, || vs ??, and single vs double quotes.
  // Anchored to https:// URLs to avoid false positives from other fallback expressions.
  const prodUrlMatch = configContent.match(/(?:\|\||\?\?)\s*["'](https?:\/\/[^"']+)["']/);
  if (prodUrlMatch === null) {
    issues.push('Failed to extract production URL fallback from src/config/index.ts - config format may have changed');
  } else {
    const hardcodedProdUrl = prodUrlMatch[1];
    const registryProdUrl = ConfigRegistry.environments['main-aws'].SITE_URL.value;
    if (hardcodedProdUrl !== registryProdUrl) {
      issues.push(`src/config/index.ts production URL "${hardcodedProdUrl}" doesn't match registry "${registryProdUrl}"`);
    }
  }
}

// Validate local-develop.SITE_URL stays in sync with main-aws.SITE_URL.
// Both represent the same production URL: main-aws sets it explicitly, local-develop
// reflects the code fallback. If main-aws.SITE_URL changes, this catches the registry drift.
const mainAwsSiteUrl = ConfigRegistry.environments?.['main-aws']?.SITE_URL?.value;
const localDevSiteUrl = ConfigRegistry.environments?.['local-develop']?.SITE_URL?.value;
if (mainAwsSiteUrl && localDevSiteUrl && mainAwsSiteUrl !== localDevSiteUrl) {
  issues.push(`Registry local-develop.SITE_URL "${localDevSiteUrl}" doesn't match main-aws.SITE_URL "${mainAwsSiteUrl}" — update local-develop to reflect the effective fallback URL`);
}

// Validate astro.config.ts env schema BUILD_ENV default against registry.
// local-develop has no workflow, so this is its primary validator coverage:
// the schema default governs what BUILD_ENV resolves to in local dev.
if (astroConfigContent) {
  const schemaDefaultMatch = astroConfigContent.match(/BUILD_ENV:[\s\S]*?default:\s*["']([^"']+)["']/);
  if (schemaDefaultMatch === null) {
    issues.push('Failed to extract BUILD_ENV schema default from astro.config.ts - config format may have changed');
  } else {
    const schemaDefault = schemaDefaultMatch[1];
    const expectedDefault = BUILD_ENV_DEFAULT;
    if (schemaDefault !== expectedDefault) {
      issues.push(`astro.config.ts BUILD_ENV schema default "${schemaDefault}" should be "${expectedDefault}" (per registry local-develop)`);
    }
  }
}

// Validate robots.txt.ts PUBLIC_DEPLOY_ENV fallback matches expected default
if (existsSync('src/pages/robots.txt.ts')) {
  const robotsContent = readFileSync('src/pages/robots.txt.ts', 'utf-8');
  const fallbackMatch = robotsContent.match(/PUBLIC_DEPLOY_ENV\s*\?\?\s*["']([^"']+)["']/);
  if (fallbackMatch === null) {
    issues.push('Failed to extract PUBLIC_DEPLOY_ENV fallback from robots.txt.ts - code format may have changed');
  } else {
    const fallbackValue = fallbackMatch[1];
    if (fallbackValue !== DEPLOY_ENV_DEFAULT) {
      issues.push(`robots.txt.ts PUBLIC_DEPLOY_ENV fallback "${fallbackValue}" should be "${DEPLOY_ENV_DEFAULT}"`);
    }
  }
}

// Validate Layout.astro PUBLIC_DEPLOY_ENV fallback matches expected default
if (existsSync('src/layouts/Layout.astro')) {
  const layoutContent = readFileSync('src/layouts/Layout.astro', 'utf-8');
  const fallbackMatch = layoutContent.match(/PUBLIC_DEPLOY_ENV\s*\?\?\s*["']([^"']+)["']/);
  if (fallbackMatch === null) {
    issues.push('Failed to extract PUBLIC_DEPLOY_ENV fallback from Layout.astro - code format may have changed');
  } else {
    const fallbackValue = fallbackMatch[1];
    if (fallbackValue !== DEPLOY_ENV_DEFAULT) {
      issues.push(`Layout.astro PUBLIC_DEPLOY_ENV fallback "${fallbackValue}" should be "${DEPLOY_ENV_DEFAULT}"`);
    }
  }
}

// Validate buildFlags coverage: every flag must have an entry for every environment.
// Missing entries silently render as '-' in generated docs, masking registry gaps.
const allEnvNames = Object.keys(ConfigRegistry.environments);
for (const [flagName, flagValues] of Object.entries(ConfigRegistry.buildFlags || {})) {
  for (const envName of allEnvNames) {
    if (!(envName in flagValues)) {
      issues.push(`Registry buildFlags.${flagName} is missing entry for environment "${envName}" (would render as '-' in docs)`);
    }
  }
}

// Validate generated docs are up to date
// Uses shared generateDocContent() to ensure validator and generator use identical logic
const docsPath = 'docs/operations/environment-configuration.md';
if (!existsSync(docsPath)) {
  issues.push('Generated docs not found. Run: npm run config:generate');
} else {
  const expectedDoc = generateDocContent(ConfigRegistry);
  // Normalize line endings before comparing to avoid CRLF/LF false positives
  const actualDoc = readFileSync(docsPath, 'utf-8').replace(/\r\n/g, '\n');
  const normalizedExpected = expectedDoc.replace(/\r\n/g, '\n');

  if (actualDoc !== normalizedExpected) {
    issues.push('Generated docs are out of date. Run: npm run config:generate');
  }
}

if (issues.length > 0) {
  console.error('❌ Validation failed:\n');
  issues.forEach(issue => console.error(`  - ${issue}`));
  process.exit(1);
}

console.log('✅ Configuration validation passed');
