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
- Google Analytics integration
- Disqus comments integration
- Social sharing component

**These are all best practices that apply to any Astro blog.**

### ⚠️ Special / Non-Standard (Specific to This Project)

#### 1. **Presentations Handling**

**The Challenge**:
- Inherited 8 Reveal.js presentations from Jekyll
- Originally embedded in blog at `/presentations/*.html`
- Needed clean migration to Astro

**The Solution - Option 2 (Recommended)**:
- Slidev as completely separate project in `slidev-presentations/`
- Independent deployment (Netlify, Vercel, or AWS)
- Linked from blog posts via external URLs
- Clean separation of concerns

**Files**:
- `slidev-presentations/` - Independent Slidev project
- `PRESENTATIONS_DEPLOYMENT.md` - Detailed architecture docs
- `build-presentations.js` - Legacy script (archived, not in main build)

**Why This is Custom**:
- Most blogs don't have embedded presentations
- Most use external services (Google Slides, etc.) instead
- Slidev is designed for single projects, not batch deployment

**Future Use**:
```bash
# Deploy Slidev independently:
npm run presentations:dev    # Dev server
npm run presentations:build  # Build for deployment
```

---

#### 2. **Custom Markdown-to-HTML Presentation Converter** (Archived)

**What It Does** (in `build-presentations.js`):
- Converts Slidev markdown to standalone HTML
- Handles markdown syntax:
  - All heading levels (# through #####)
  - Lists (both `-` and `*` syntax)
  - **Bold** text
  - *Italic* text
  - [Links](url)
  - ![Images](url) with responsive styling
- Generates complete presentation UI with:
  - Keyboard navigation (arrow keys, spacebar)
  - Slide counter and progress bar
  - Fullscreen support
  - Mobile responsive design

**Why It's Archived** (Not Recommended):
- ❌ Adds complexity to build pipeline
- ❌ Custom markdown converter has edge cases
- ❌ Not reusable across projects
- ❌ Defeats Slidev's interactive features
- ❌ Harder to maintain and test

**Legacy Usage** (if needed):
```bash
# Build presentations to HTML (not in main pipeline)
npm run build:presentations
# Generates: public/presentations/*.html
```

**Recommendation**: Use standalone Slidev deployment instead (Option 2).

---

#### 3. **Migration Scripts** (One-Time Use)

Located in root directory:
- `migrate-posts.js` - Converted 36 Jekyll posts → Astro
- `migrate-pages.js` - Converted 9 Jekyll pages → Astro
- `migrate-presentations.js` - Converted 8 Reveal.js presentations → Slidev
- `fix-yaml.js` - Fixed YAML indentation issues
- `add-descriptions.js` - Added missing post descriptions

**Status**: ✅ Complete, archived for reference

**Reusability**:
- Not reusable as-is (Jekyll-specific)
- Could be adapted for other static site generators
- Good examples of content transformation patterns

---

## Features That Are Standard Best Practice

### Content Collections

✅ **File**: `src/content/config.ts`
✅ **Standard**: Yes - Astro recommended approach
✅ **Reusable**: Yes - can adapt schema for other projects

Three collections defined:
- `blog` - 36 migrated posts
- `pages` - 9 migrated static pages
- `presentations` - For future use

Zod schemas enforce type safety on all content.

### Dynamic Routing

✅ **Files**:
- `src/pages/blog/[...slug].astro` - Individual posts
- `src/pages/categories/[category].astro` - Category archives
- `src/pages/tags/[tag].astro` - Tag archives

✅ **Standard**: Yes - Astro file-based routing pattern

### Search with Pagefind

✅ **Status**: Integrated and working
✅ **Standard**: Yes - recommended for static sites
✅ **Customization**: None needed (uses defaults)

Indexes all 48 pages (blog posts + static pages) with 4,688 words.

### Analytics & Comments

✅ **Files**:
- `src/components/GoogleAnalytics.astro` - GA4 ready (needs ID)
- `src/components/DisqusComments.astro` - Comment threading

✅ **Standard**: Yes - both have standard integrations

### Social Sharing

✅ **File**: `src/components/SocialShare.astro`
✅ **Standard**: Yes - common blog feature
✅ **Platforms**: Twitter, Facebook, LinkedIn, Email

---

## Build Pipeline

### Main Blog Build

```bash
npm run build
```

**Process**:
1. `astro build` - Build static site (48 pages)
2. `pagefind --source dist` - Index for search

**Output**: `dist/` (ready to deploy)

### Presentations Build (Standalone)

```bash
npm run presentations:dev
npm run presentations:build
npm run presentations:export
```

**Deployed separately** to Netlify/Vercel or AWS

---

## Configuration Files

### Astro Configuration

**File**: `astro.config.mjs`

```javascript
export default defineConfig({
  site: 'https://kyle.skrinak.com',
  output: 'static',
  integrations: [mdx(), sitemap()],
});
```

✅ **Standard**: Yes, minimal config

### Content Schema

**File**: `src/content/config.ts`

Defines three collections with strict Zod validation:
- Blog posts: title, pubDate, description, categories, tags, etc.
- Pages: title, description, permalink, toc
- Presentations: title, date, theme, tags

✅ **Standard**: Yes, Astro recommended approach

### Environment Variables

**File**: `.env.local` (not in Git)

```env
PUBLIC_GA_ID=G-XXXXX          # Google Analytics
PUBLIC_DISQUS_SHORTNAME=...   # Disqus shortname
```

---

## Deployment Architecture

### Staging (GitHub Pages)

✅ **Trigger**: Push to `staging` branch
✅ **Process**: GitHub Actions → Build → Deploy
✅ **URL**: GitHub Pages URL

### Production (AWS S3 + CloudFront)

✅ **Trigger**: Push to `main` branch
✅ **Process**: GitHub Actions → Build → S3 Sync → CloudFront Invalidation
✅ **Cache Strategy**:
  - HTML: 5 minutes
  - JS/CSS: 1 hour
  - Assets: 1 year (immutable)

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

4. **Add features to presentation converter**
   - It's archived (not recommended)
   - Use standalone Slidev instead

5. **Modify GitHub Actions without testing staging first**
   - Staging → Production workflow
   - Test CI/CD changes on staging branch

---

## Maintenance Guide

### Adding New Blog Posts

1. Create `src/content/blog/YYYY-MM-DD-slug.md`
2. Include required front matter (title, pubDate, description)
3. Optional: categories, tags
4. Build: `npm run build`

### Adding New Pages

1. Create `src/content/pages/page-slug.md`
2. Include required front matter (title)
3. Build: `npm run build`

### Updating Presentations

1. Edit `slidev-presentations/slides/NN-*.md`
2. `npm run presentations:dev` to preview
3. `npm run presentations:build` to compile
4. Deploy independently (not part of blog build)

### Updating Deployment

1. Modify `.github/workflows/production.yml` for AWS changes
2. Modify `.github/workflows/staging.yml` for GitHub Pages changes
3. Test on staging branch first

---

## Key Decisions & Rationale

### Decision 1: Content Collections + Zod

**Why**: Type safety, schema validation, Astro best practice

**Alternative Considered**: Raw MDX without schema
- ❌ No type checking
- ❌ Easier to create invalid content
- ✅ Collections approach is better

### Decision 2: Option 2 - Standalone Slidev

**Why**: Clean separation, independent deployment, no custom code

**Alternative Considered**: Embed presentations in Astro build
- ❌ Custom converter adds complexity
- ❌ Harder to update presentations
- ❌ Not following Slidev conventions
- ✅ Option 2 is simpler and more maintainable

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
- ✓ Add more comment systems (Giscus, etc.)
- ✓ Add dark mode toggle
- ✓ Add related posts sidebar
- ✓ Add estimated reading time
- ✓ Add table of contents generation
- ✓ Add syntax highlighting customization
- ✓ Add image optimization
- ✓ Add webp image format support

---

## Documentation Files

| File | Purpose |
|------|---------|
| `MIGRATION_STATUS.md` | Current state of migration, all 5 phases |
| `PRESENTATIONS_DEPLOYMENT.md` | How presentations are deployed (Option 2) |
| `DEPLOYMENT.md` | AWS setup, GitHub secrets, troubleshooting |
| `PRESENTATIONS_FIX.md` | Details on presentation HTML generation |
| `SPECIAL_FEATURES.md` | This file - unique features & decisions |

---

## Summary

✅ **Best Practices Used**:
- Astro framework and patterns
- Content Collections + Zod
- GitHub Actions CI/CD
- AWS deployment with caching
- Pagefind search
- Standard integrations (Analytics, Comments)

⚠️ **Custom/Non-Standard Elements**:
- Presentation handling (Option 2: Standalone Slidev)
- Migration scripts (one-time use, now archived)
- Custom markdown converter (archived, not recommended)

**Recommendation**: For future projects, follow the **standard practices** documented here. The **custom elements** are specific to this blog's history and should not be replicated in new projects.
