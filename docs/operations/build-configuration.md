# Build & Configuration Guide

## Build Scripts Overview

This project has two distinct build commands, each serving different purposes:

### `npm run build` - Local Development Build
**Purpose**: Full local build with asset optimization
**Includes**: 
- Image convention, resume, and directive lint checks
- Type checking (`astro check`)
- Astro compilation
- Pagefind search index generation
- Copy of the search index to `public/pagefind/` (`copy-pagefind.mjs`), so `npm run dev` serves search

**Command**:
```bash
npm run build
```

**Output**: Complete site in `dist/`, with the search index in `dist/pagefind/` and a copy in `public/pagefind/` (gitignored)

### `npm run build:ci` - CI/Production Build
**Purpose**: Minimal build for CI pipelines (production deployment)
**Includes**:
- Image convention, resume, and directive lint checks
- Type checking (`astro check`)
- Astro compilation
- Pagefind search index generation
- ⚠️ **No copy to `public/`** (the deploy uploads `dist/`)

**Command**:
```bash
npm run build:ci
```

**Output**: Site in `dist/` with search index in `dist/pagefind/`

---

## Pagefind

Pagefind runs without a configuration file and writes to its default output directory, `dist/pagefind/`. The search page loads the bundle from `/pagefind/`.

Issue #443 took this setup from upstream AstroPaper. Before #443, a `pagefind.json` set `output_subdir: "_pagefind"` and the build copied the index with `cp -r`. Upstream's `copy-pagefind.mjs` replaces `cp` because, in its own comment, "cmd.exe, the shell npm/pnpm runs scripts with on Windows, has no `cp`".

---

## Debugging Build Issues

### Issue: Pagefind not found

```bash
npm run build
ls -la dist/pagefind/ public/pagefind/
```

Both directories should hold `pagefind.js` and the `index/` and `fragment/` directories.

### Issue: Search index missing in production

```bash
npm run build:ci
ls -la dist/pagefind/
```

`build:ci` writes the index to `dist/pagefind/` and doesn't copy it to `public/`. The deploy uploads `dist/` to S3, index included.

---

## Configuration Management

The project uses a centralized configuration registry (`config/registry.mjs`) to prevent drift across environments, workflows, and documentation.

### Available Commands

```bash
npm run config:generate  # Generate environment-configuration.md from registry
npm run config:validate  # Validate config consistency across all sources
npm run config:inspect   # Debug configuration values (interactive)
```

### Validation Coverage

The validator (`npm run config:validate`) enforces consistency across:
- Workflow environment variables ↔ Registry
- Env schema (astro.config.ts) ↔ Registry
- Code usage (`process.env.*`) ↔ Env schema
- Deployment variables (GitHub vars.*) ↔ Registry
- Generated documentation ↔ Registry
- Hardcoded fallback values ↔ Registry

**CI Enforcement**: Validation runs in all deployment workflows. Configuration drift prevents merging/deploying.

### When to Update Configuration

1. Change value in `config/registry.mjs`
2. Run `npm run config:generate` to update docs
3. Run `npm run config:validate` to verify consistency
4. Update workflows if needed
5. Commit all changes together

See `docs/operations/environment-configuration.md` for complete registry documentation.

---

## Deployment Specific

### AWS S3 + CloudFront (Production)
- Uses `main` branch  
- Builds with `build:ci` (no copy step)
- S3 sync includes entire `dist/` directory (including `dist/pagefind/`)
- Search assets served from S3 automatically ✅

---

## Analytics

### Cloudflare Web Analytics

The site integrates Cloudflare Web Analytics for privacy-friendly, lightweight traffic monitoring on production (kyle.skrinak.com).

**Configuration**:

- **Token**: Set via environment variable `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`.
- **Loading**: Beacon loads only when `import.meta.env.PROD === true` and the token is present.
- **Privacy**: No cookies; minimal data collection. Update privacy page to disclose usage.

**Setup**:

1. Create a Cloudflare Web Analytics site and copy the beacon token.
2. Set the token in your CI environment (GitHub Actions / AWS):
   ```bash
   PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=cfb_xxxxx
   ```
3. Build and deploy; beacon loads automatically in production.

**Validation**:

- Check Cloudflare dashboard for incoming data.
- Inspect Network tab in DevTools on production; verify `beacon.min.js` loads and sends events.

---

## Composite Actions

### setup-node-build

Centralizes Node.js setup across all workflows to ensure consistency.

**Location**: `.github/actions/setup-node-build/action.yml`

**Configuration**:
- Node.js version: 24
- npm caching: enabled
- Dependency installation: handled by separate `npm ci` steps in each workflow

**Used by**:
- `production-deploy.yml`
- `linkwatch.yml`
- `pr-visual-check.yml`

**Benefits**:
- DRY principle: single source of truth for Node setup
- Consistent environment across all workflows
- Easier to update Node version (change once, applies everywhere)

---

## Design Decisions

### Location references in registry.mjs

The `location` field in registry entries specifies files (e.g., `astro.config.ts`)
without line numbers. Line numbers were intentionally omitted because they drift
after refactors and become misleading. The gating expression validation in
`config/validate.mjs` ensures correctness — file-level locations provide
orientation without the maintenance burden of tracking line numbers.

---

## References

- [Pagefind Documentation](https://pagefind.app/)
- [Deployment Guide](./deployment.md)
- [GitFlow Documentation](./gitflow.md) - Branch workflow and PR strategy
- [astro.config.ts](../../astro.config.ts) - Astro configuration
- [copy-pagefind.mjs](../../copy-pagefind.mjs) - Copies the search index to `public/pagefind/`
