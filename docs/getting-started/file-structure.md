# File Structure

> ⚠️ **This document is a placeholder. See README.md for current structure overview.**

## Quick Reference

See [README.md - Project Structure](../../README.md#-project-structure) for the current file organization.

## Directory Overview

```
/
├── .github/
│   ├── workflows/        # CI/CD workflows
│   └── actions/          # Composite actions (setup-node-build)
├── design/               # Graphic source files (not deployed)
├── docs/                 # All documentation
│   ├── getting-started/  # Setup and onboarding
│   ├── operations/       # Deployment and maintenance
│   ├── features/         # Feature documentation
│   ├── testing/          # Testing guides
│   └── archive/          # Historical docs (migration, launch)
├── src/
│   ├── content/
│   │   ├── blog/         # Blog posts (markdown)
│   │   └── pages/        # Static pages
│   ├── components/       # Reusable Astro/React components
│   ├── layouts/          # Page layouts
│   ├── pages/            # Route definitions (Astro file-based routing)
│   └── styles/           # Global styles
├── public/               # Static assets (copied to dist/)
├── tests/                # Playwright test suites
│   ├── visual/           # Visual regression tests
│   ├── seo/              # SEO validation tests
│   └── analytics/        # Analytics privacy tests
├── scripts/              # Build and utility scripts
├── playwright-report/    # Playwright HTML reports (gitignored)
├── test-results/         # Playwright test artifacts (gitignored)
└── lighthouse-reports/   # Lighthouse audit reports (gitignored)
```

## Key Configuration Files

| File | Purpose |
|------|---------|
| `astro.config.ts` | Astro framework configuration |
| `tailwind.config.mjs` | TailwindCSS configuration |
| `playwright.config.ts` | Playwright test configuration |
| `pagefind.json` | Search index configuration |
| `.htmltest.yml` | Link validation configuration |
| `tsconfig.json` | TypeScript configuration |

## Important Patterns

**Content Collections**:
- `src/content/config.ts` - Zod schemas for type-safe content
- `src/content/blog/*.md` - Blog posts with front matter
- `src/content/pages/*.md` - Static pages

**Dynamic Routes**:
- `src/pages/posts/[...slug].astro` - Individual blog posts
- `src/pages/tags/[tag].astro` - Tag archive pages
- `src/pages/categories/[category].astro` - Category archives

**Testing**:
- `tests/**/*.spec.ts` - Playwright test suites
- `tests/visual/visual-regression.spec.ts-snapshots/` - Visual regression baselines (gitignored)

## Future Content

This document will eventually include:
- Detailed explanation of each directory
- File naming conventions
- Import patterns and module organization
- Asset management strategy
- Test file organization
- Build output structure

For current details, see:
- [README.md](../../README.md)
- [Special Implementations](../features/special-implementations.md)
- [Creating Posts](./creating-posts.md)
