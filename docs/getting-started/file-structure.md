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
│   └── testing/          # Testing guides
├── src/
│   ├── content.config.ts # Content collection schemas (posts, pages)
│   ├── content/
│   │   ├── posts/
│   │   │   └── YYYY-MM-DD-slug/    # Each post is a directory
│   │   │       ├── index.md        # or index.mdx
│   │   │       └── *.webp          # Co-located images
│   │   └── pages/
│   │       ├── about.mdx           # A page as a single file
│   │       └── <slug>/             # or a directory with co-located images
│   │           └── index.md
│   ├── components/       # Reusable Astro components
│   ├── layouts/          # Page layouts
│   ├── pages/            # Route definitions (Astro file-based routing)
│   └── styles/           # Global styles
├── public/               # Static assets (copied to dist/ verbatim)
│   └── presentations/    # Standalone presentation HTML + assets
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
| `astro-paper.config.ts` | Theme settings (upstream AstroPaper's config file) |
| `src/site-config.ts` | Site-only constants |
| `playwright.config.ts` | Playwright test configuration |
| `.htmltest.yml` | Link validation configuration |
| `tsconfig.json` | TypeScript configuration |

## Important Patterns

**Content Collections**:
- `src/content.config.ts` - Zod schemas for type-safe content (uses Astro's `image()` helper so frontmatter image paths resolve to `ImageMetadata`)
- `src/content/posts/<slug>/index.{md,mdx}` - Blog posts as per-post directories with co-located images
- `src/content/pages/` - Static pages, as a single file (`about.mdx`) or a directory with co-located images (`lchf/index.md`, `resume/index.md`). Each has a route file in `src/pages/` (`about.astro`, `lchf.astro`, `resume.astro`) that reads its entry

**Dynamic Routes**:
- `src/pages/posts/[...slug]/index.astro` - Individual blog posts
- `src/pages/tags/[tag]/[...page].astro` - Tag archive pages, paginated
- `src/pages/categories/[category].astro` - Category archives

**Testing**:
- `tests/**/*.spec.ts` - Playwright test suites
- `tests/visual/visual-regression.spec.ts-snapshots/` - Visual regression baselines (committed)

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
