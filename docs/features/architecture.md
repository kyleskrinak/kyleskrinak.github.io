# Architecture Overview

> ⚠️ **This document is a placeholder. See special-implementations.md for current architecture details.**

## Quick Reference

For detailed architecture information, see:
- [Special Implementations](./special-implementations.md) - Custom features and design decisions
- [Build Configuration](../operations/build-configuration.md) - Build pipeline architecture
- [Deployment Guide](../operations/deployment.md) - Deployment architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Workflow                        │
├─────────────────────────────────────────────────────────────┤
│  develop → main (PR-based flow)                              │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Build & Test (CI/CD)                       │
├─────────────────────────────────────────────────────────────┤
│  • Astro SSG build                                          │
│  • Pagefind search indexing                                 │
│  • Visual regression testing (PR artifact baseline)         │
│  • Link validation (htmltest + Playwright)                  │
│  • SEO & analytics privacy tests                            │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                      Deployment                              │
├─────────────────────────────────────────────────────────────┤
│  GitHub Pages (disaster-recovery fallback, manual dispatch): │
│    kyleskrinak.github.io/ (root) — normally a redirect stub  │
│  Production (AWS S3 + CloudFront): kyle.skrinak.com          │
└─────────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### 1. **Static Site Generation (SSG)**
- Astro compiles all pages to static HTML at build time
- No server-side rendering required
- Deploy to any static host (S3, GitHub Pages, etc.)

### 2. **Content Collections with Type Safety**
- Zod schemas enforce content structure
- TypeScript ensures compile-time safety
- See `src/content/config.ts`

### 3. **Two-Tier Link Validation**
- First pass: htmltest (fast HTTP checks)
- Second pass: Playwright (real browser, bypasses bot detection)
- Minimizes false positives
- See [Link Checking Guide](../link-checking.md)

### 4. **Artifact-Based Visual Regression**
- No cloud service dependency (Percy, Chromatic, etc.)
- GitHub Actions artifacts store baselines (90-day retention)
- Secure two-workflow pattern (untrusted PR code + secure commenting)
- See [Visual Regression Guide](../testing/visual-regression.md)

### 5. **Environment-Based Feature Gating**
- Analytics load only in production with valid tokens
- Respects DNT/GPC privacy signals
- Environment variables control behavior (deploy-environment gating, independent of which host serves the build)

### 6. **Deployment Targets**
- **Production (AWS S3 + CloudFront)**: CDN-backed, intelligent caching; the only continuously deployed target
- **GitHub Pages (disaster-recovery fallback)**: manual `workflow_dispatch` only, normally serves a redirect stub to production; publishes the real site only if manually dispatched with `mode=full-fallback` during an AWS outage
- Same codebase, different configurations

## Component Architecture

**Layouts**:
- `src/layouts/Layout.astro` - Base layout (head, analytics, body)
- `src/layouts/PostDetails.astro` - Blog post layout

**Pages** (Astro file-based routing):
- Static: `src/pages/index.astro`, `about.astro`, etc.
- Dynamic: `src/pages/posts/[...slug].astro` (blog posts)
- Generated: `src/pages/sitemap.xml.ts`, `rss.xml.ts`

**Components**:
- Shared across pages and layouts
- Mix of Astro and framework components
- See `src/components/`

## Data Flow

```
Content (markdown) → Content Collections → Type-safe queries →
  → Astro components → Static HTML → Deploy
```

## Future Content

This document will eventually include:
- Detailed component hierarchy diagrams
- Data flow visualizations
- State management patterns
- Performance optimization strategies
- Security architecture
- Caching strategy details
- Integration patterns (analytics, comments, search)

For current architectural details, see:
- [Special Implementations](./special-implementations.md)
- [Build Configuration](../operations/build-configuration.md)
- [GitFlow Workflow](../operations/gitflow.md)
