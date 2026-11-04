# Special Features and Custom Implementations

## Overview

This document catalogs special use cases, custom implementations, and unique configurations in this Astro blog migration. It serves as a reference for future developers maintaining this project.

## What's Unique to This Project?

### ✅ Standard (Reusable for Any Astro Blog)

- Astro project structure and configuration
- Content Collections with Zod schemas
- Dynamic routing for blog, categories, tags
- RSS feed generation
- Sitemap generation
- Pagefind search integration
- GitHub Actions CI/CD workflows
- AWS S3 + CloudFront deployment
- Cloudflare Web Analytics integration
- Social sharing component

**These are all best practices that apply to any Astro blog.**

### ⚠️ Special / Non-Standard (Specific to This Project)

#### 1. **Presentations Handling**

**The Challenge**:
- Inherited 8 Reveal.js presentations from Jekyll
- Originally embedded in blog at `/presentations/*.html`
- Needed clean migration to Astro

**The Solution**:
- Each deck is a standalone HTML file in `public/presentations/`, deployed with the site at `/presentations/<id>.html`
- `src/data/presentations.json` lists the 8 decks; `src/pages/presentations/index.astro` and `src/pages/presentations/[id].astro` build `/presentations/` and `/presentations/<id>/` from it
- Each deck carries `data-pagefind-body`, so Pagefind indexes it
- Rationale (CHANGELOG.md): "SEO optimization, simplicity, no client-side framework overhead"

**Files**:
- `public/presentations/` - The 8 deck HTML files and their assets
- `src/data/presentations.json` - Deck metadata
- `slidev-presentations/slides/` - Slidev-style markdown sources (one deck, `2026-02-22-squarespace-to-astro`, has a source; the other 7 exist only as HTML)
- `scripts/build-presentations.js` - Converts the sources to HTML (section 2)

**Documentation**:
- See CHANGELOG.md "Jekyll → Astro Migration" section for architectural decisions
- See `slidev-presentations/README.md` for adding a deck

**Why This is Custom**:
- Most blogs don't have embedded presentations
- Most use external services (Google Slides, etc.) instead
- Slidev is designed for single projects, not batch deployment

**Note**: `npm run build` doesn't run the converter. After editing a source, run `npm run build:presentations` and commit the regenerated HTML.

---

#### 2. **Custom Markdown-to-HTML Presentation Converter**

**What It Does** (in `scripts/build-presentations.js`):
- Converts Slidev markdown to standalone HTML
- Parses the markdown with `markdown-it` and sanitizes the output with `sanitize-html`
- Generates complete presentation UI with:
  - Keyboard navigation (arrow keys, spacebar)
  - Slide counter and progress bar
  - Fullscreen support
  - Mobile responsive design

**Trade-offs**:
- ❌ Custom markdown converter has edge cases
- ❌ Not reusable across projects
- ❌ Defeats Slidev's interactive features
- ❌ Harder to maintain and test

**Usage**:
```bash
# Runs apart from npm run build
npm run build:presentations
# Generates: public/presentations/<source-name>.html
```

---

#### 3. **Visual Regression Testing**

**The Implementation**:
- Playwright visual regression tests for key pages
- Baselines committed to `tests/visual/visual-regression.spec.ts-snapshots/`
- Run locally during development, and enforced as a CI gate on PRs targeting `main` (`.github/workflows/pr-visual-check.yml`)

**Why This is Custom**:
Most projects use Percy.io, Chromatic, or other cloud services. This project maintains baselines in the repo and enforces them via a GitHub Actions gate instead of a third-party visual diffing service.

**Files**:
- `tests/visual/visual-regression.spec.ts` - Test suite
- `.github/workflows/pr-visual-check.yml` - CI gate on PRs to `main`

**Trade-offs**:
- ✅ No cloud service cost
- ✅ Full control over baseline storage
- ✅ Automated PR regression check against committed baselines
- ⚠️ No visual diff UI in PR (diffs uploaded as a workflow artifact on failure)

---

#### 4. **Migration Scripts** (One-Time Use)

**Note**: These scripts were used during the Jekyll→Astro migration and have been removed from the repository after completion. Listed here for historical reference:

- `migrate-posts.js` - Converted 36 Jekyll posts → Astro
- `migrate-pages.js` - Converted 9 Jekyll pages → Astro
- `migrate-presentations.js` - Converted 8 Reveal.js presentations → Slidev
- `fix-yaml.js` - Fixed YAML indentation issues
- `add-descriptions.js` - Added missing post descriptions

**Status**: ✅ Complete, scripts removed after successful migration

**Reusability**:
- Not reusable as-is (Jekyll-specific)
- Could be adapted for other static site generators
- Good examples of content transformation patterns

---

## Features That Are Standard Best Practice

### Content Collections

✅ **File**: `src/content.config.ts`
✅ **Standard**: Yes - Astro recommended approach
✅ **Reusable**: Yes - can adapt schema for other projects

Two collections defined:
- `posts` - Blog posts, in `src/content/posts/`
- `pages` - Static pages (about, lchf, resume), in `src/content/pages/`

Zod schemas enforce type safety on all content.

### Dynamic Routing

✅ **Files**:
- `src/pages/posts/[...slug]/index.astro` - Individual post pages (uses PostLayout)
- `src/pages/[year]/[month]/[day]/[...slug].astro` - Legacy redirect route (Jekyll URL compatibility)
- `src/pages/categories/[category].astro` - Category archives
- `src/pages/tags/[tag]/[...page].astro` - Tag archives, paginated

✅ **Standard**: Yes - Astro file-based routing pattern

### Search with Pagefind

✅ **Status**: Integrated and working
✅ **Standard**: Yes - recommended for static sites
✅ **Customization**: None needed (uses defaults)

Indexes the post pages (`data-pagefind-body` in `src/pages/posts/[...slug]/index.astro`) and the 8 presentation decks.

### Analytics

✅ **Files**:
- `src/components/CloudflareBeacon.astro`, inserted in `src/layouts/Layout.astro` - Cloudflare Web Analytics beacon (gated on `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`, production builds only)

✅ **Standard**: Yes - standard integration

### Social Sharing

✅ **File**: `src/pages/posts/[...slug]/_components/ShareLinks.astro`
✅ **Standard**: Yes - common blog feature
✅ **Platforms**: Facebook, X, LinkedIn, plus the native Web Share button where the browser supports it

---

## Build Pipeline

### Main Blog Build

```bash
npm run build
```

**Process**:
1. Lint checks: `check-image-conventions.mjs`, `lint-resume.mjs`, `lint-directives.mjs`
2. `astro check` - Type check
3. `astro build` - Build static site
4. `pagefind --site dist` - Index for search
5. `node copy-pagefind.mjs` - Copy the index to `public/pagefind/` for `npm run dev` (`npm run build:ci` skips this step)

**Output**: `dist/` (ready to deploy)

### Presentations Build (Separate Command)

`npm run build:presentations` converts each source in `slidev-presentations/slides/` to `public/presentations/<name>.html`. It runs apart from `npm run build`, which copies `public/presentations/` into `dist/` with the rest of `public/`.

---

## Configuration Files

### Astro Configuration

**File**: `astro.config.ts`

```javascript
export default defineConfig({
  base,
  site: config.site.url,
  trailingSlash: "always",
  integrations: [mdx()],
  // ...
});
```

Excerpt. The full file also sets i18n, the markdown plugins, the Fonts API and the env schema. It has no sitemap integration: the site serves `/sitemap.xml` from `src/pages/sitemap.xml.ts`.

✅ **Standard**: Yes, upstream AstroPaper's config with the site's overrides (see `UPSTREAM.md`)

### Content Schema

**File**: `src/content.config.ts`

Defines two collections with strict Zod validation:
- Blog posts: title, pubDatetime, description, categories, tags, etc.
- Pages: title, plus optional description, permalink, toc and the resume's fields

✅ **Standard**: Yes, Astro recommended approach

### Environment Variables

**File**: `.env.local` (not in Git)

```env
PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=your_token_here    # Cloudflare Web Analytics
```

---

## Deployment Architecture

### Production (AWS S3 + CloudFront)

✅ **Trigger**: Push to `main` branch
✅ **Process**: GitHub Actions → Build → S3 Sync → CloudFront Invalidation
✅ **Cache Strategy**:
  - `_astro/*` and `pagefind/*`: 1 year (immutable)
  - Everything else, HTML included: 5 minutes

✅ **Standard**: Yes, recommended AWS deployment pattern

---

## What Should NOT Be Changed

### ❌ Don't:

1. **Modify content schema without migration**
   - Zod schemas are strict
   - Changes require migrating all content

2. **Change dynamic route structure**
   - URL patterns are permanent
   - Would break external links

3. **Remove Pagefind integration**
   - Search is core feature
   - Use standard Pagefind features only

4. **Modify GitHub Actions without testing on a PR first**
   - Develop → Production workflow
   - Test CI/CD changes on a `develop → main` PR before merging

---

## Maintenance Guide

### Adding New Blog Posts

1. Create `src/content/posts/YYYY-MM-DD-slug/index.md`, with any post images co-located in that
   directory (or scaffold it: `npm run new-post -- YYYY-MM-DD-slug`)
2. Include required front matter (title, pubDatetime, description)
3. Optional: categories, tags
4. Build: `npm run build`

### Adding New Pages

1. Create `src/content/pages/page-slug.md`, or `src/content/pages/page-slug/index.md` with co-located images
2. Include required front matter (title)
3. Add a route file in `src/pages/` that reads the entry, as `about.astro`, `lchf.astro` and `resume.astro` do
4. Build: `npm run build`

### Updating Presentations

1. Edit `slidev-presentations/slides/YYYY-MM-DD-slug.md`
2. Build using root-level script: `npm run build:presentations` (see `scripts/build-presentations.js`)
3. Commit the regenerated HTML in `public/presentations/`; it deploys with the site

### Updating Deployment

1. Modify `.github/workflows/production-deploy.yml` for AWS changes
2. Test on a `develop → main` PR first

---

## Key Decisions & Rationale

### Decision 1: Content Collections + Zod

**Why**: Type safety, schema validation, Astro best practice

**Alternative Considered**: Raw MDX without schema
- ❌ No type checking
- ❌ Easier to create invalid content
- ✅ Collections approach is better

### Decision 2: Presentations as Standalone HTML

**Why** (CHANGELOG.md): SEO optimization, simplicity, no client-side framework overhead

**How**: Each deck is a static HTML file in `public/presentations/`, deployed with the site. The Astro build doesn't render the decks.

### Decision 3: AWS S3 + CloudFront

**Why**: Performance, caching strategy, scalability

**Alternative Considered**: GitHub Pages for everything
- ✅ Free
- ❌ No caching control
- ❌ No CDN optimization
- ✅ AWS approach is better for performance

---

## Future Enhancements (Non-Breaking)

These can be added without changing core architecture:

- ✓ Add more analytics (Plausible, etc.)
- ✓ Add a comment system (Giscus, etc.)
- ✓ Add related posts sidebar

---

## Documentation Files

| File | Purpose |
|------|---------|
| `CHANGELOG.md` | Migration history and technical decisions (see "Jekyll → Astro Migration" section) |
| `docs/operations/deployment.md` | AWS setup, GitHub secrets, troubleshooting |
| `docs/features/special-implementations.md` | This file - unique features & decisions |

---

## Summary

✅ **Best Practices Used**:
- Astro framework and patterns
- Content Collections + Zod
- GitHub Actions CI/CD
- AWS deployment with caching
- Pagefind search
- Standard integrations (Analytics)

⚠️ **Custom/Non-Standard Elements**:
- Presentation handling (standalone HTML decks in `public/presentations/`)
- Migration scripts (one-time use, now removed)
- Custom markdown converter (`scripts/build-presentations.js`, run apart from the main build)

**Recommendation**: For future projects, follow the **standard practices** documented here. The **custom elements** are specific to this blog's history and should not be replicated in new projects.
