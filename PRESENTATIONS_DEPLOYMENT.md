# Presentations Deployment - Special Use Case Documentation

## Overview

This project includes **8 Reveal.js presentations** that were originally part of a Jekyll blog. This document describes how presentations are now handled separately from the main Astro blog, following **Option 2: Standalone Slidev Deployment**.

## Architecture Decision: Option 2 (Recommended)

### Why Separate Presentations?

**Before (Anti-Pattern):**
- Custom Node.js build script converting Slidev markdown → HTML
- Presentations included in main blog build
- Custom markdown-to-HTML converter with edge cases
- Added complexity to blog deployment

**After (Best Practice):**
- Slidev as a completely separate project
- Independent deployment (can use any hosting: Netlify, Vercel, AWS, etc.)
- Clean separation of concerns
- Easier to maintain and update presentations independently
- Standard Slidev workflows (dev, build, export)

## File Structure

```
astro-blog/
├── slidev-presentations/          # Separate Slidev project
│   ├── slides/
│   │   ├── 01-bundle-test.md
│   │   ├── 02-2019-feb-13-slg-presentation.md
│   │   ├── 03-2019-drupalcon-drupal-8-multisite.md
│   │   ├── 04-tts-profile-mgmt.md
│   │   ├── 05-drupal-intro.md
│   │   ├── 06-drupal-multisite-on-a-dime.md
│   │   ├── 07-code-presentation.md
│   │   └── 08-wohd.md
│   ├── package.json
│   ├── slidev.config.ts
│   └── dist/                      # Built presentations
│
├── build-presentations.js         # Legacy script (for reference only)
├── package.json                   # Main blog scripts
├── astro.config.mjs
└── src/                           # Main Astro blog
    └── content/blog/              # 36 blog posts
```

## Build Scripts

### Main Blog Build (Astro only)

```bash
npm run build
```

**Output**: `dist/` - Static Astro site (no presentations included)

### Presentations (Standalone)

```bash
# Development server
npm run presentations:dev
# Visit: http://localhost:5173/

# Export to static HTML
npm run presentations:export
# Output: slidev-presentations/dist/

# Build for deployment
npm run presentations:build
```

## Deployment Options

### Option A: Netlify (Recommended for Presentations)

**Presentations at: `slidev.yoursite.com` or `yoursite.com/presentations`**

```bash
# netlify.toml
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/presentations/*"
  to = "https://slidev-instance.netlify.app/:splat"
```

### Option B: Vercel

```bash
# vercel.json in slidev-presentations/
{
  "buildCommand": "npm run presentations:build",
  "outputDirectory": "dist"
}
```

### Option C: Static Export + CDN

```bash
npm run presentations:export
# Copy dist/ to S3/CloudFront under /presentations/ path
```

### Option D: GitHub Pages (Separate Repo)

Keep presentations in a separate repository:
```
presentations-repo/
├── .github/workflows/
│   └── deploy.yml
└── slidev-presentations/
```

## Linking from Blog to Presentations

In Astro blog posts, link to presentations:

```markdown
## Related Presentation

[View Drupal Multisite Presentation](https://slidev.yoursite.com/06-drupal-multisite-on-a-dime)
```

## Special Use Case: Custom Markdown to HTML Converter

### Background

During migration from Jekyll/Reveal.js to Astro/Slidev, a custom Node.js script (`build-presentations.js`) was created to convert Slidev markdown presentations to standalone HTML files.

### Why This Was Created

- Original presentations used Reveal.js (JavaScript presentation library)
- When migrating to Astro, needed presentations accessible at `/presentations/*.html`
- Slidev projects are designed for single presentations, not batch exports
- Custom script solved this by converting Slidev markdown to HTML

### Features of Custom Converter

✓ Parses Slidev markdown (slides separated by `---`)
✓ Converts markdown to HTML:
  - Headings: `#` → `<h1>` (handles 6+ levels, caps at h6)
  - Lists: `- item` and `* item` → `<ul><li>`
  - Bold: `**text**` → `<strong>`
  - Italic: `*text*` → `<em>`
  - Links: `[text](url)` → `<a>`
  - **Images**: `![alt](url)` → `<img>` (with responsive styling)
✓ Generates complete HTML files with:
  - Professional gradient backgrounds
  - Keyboard navigation (arrow keys, spacebar)
  - Mouse controls (Previous/Next buttons)
  - Fullscreen support
  - Progress bar and slide counter
  - Mobile responsive design

### Why NOT to Use Custom Converter

**This is an anti-pattern - only kept for reference:**

1. **Maintenance burden** - Custom markdown converter needs updates
2. **Edge cases** - Markdown syntax edge cases keep appearing
3. **Not reusable** - Specific to this project
4. **Defeats Slidev purpose** - Loses interactive features
5. **Harder to test** - No standard tests

### Legacy Script Usage (Not Recommended)

```bash
# If you must use it:
npm run build:presentations

# This generates: public/presentations/*.html
# Output will be included in dist/ if placed in public/
```

**However**: Using the standalone Slidev deployment (Option 2) is strongly recommended instead.

## Migration Notes

### From Custom Build Script → Standalone Slidev

If you previously used `npm run build:presentations`:

1. **Stop using it**: Remove `build:presentations` from main build
2. **Deploy Slidev independently**: Use one of the deployment options above
3. **Update blog links**: Point to new Slidev URL (e.g., `https://slidev.yoursite.com/`)
4. **Archive the script**: Keep `build-presentations.js` in Git history for reference

### Converting Regular Slidev Back to Custom HTML

If presentations don't work in Slidev viewer on your hosting:

```bash
npm run build:presentations
# Generates HTML files in public/presentations/
# Then include public/ in Astro build
```

## Presentations Content

### 8 Original Presentations

| # | Title | Slides | Created |
|---|-------|--------|---------|
| 1 | Bundle Test | 10 | 2018-12-28 |
| 2 | 2019-Feb-13 SLG Presentation | 12 | 2019-02-12 |
| 3 | 2019 DrupalCon Drupal 8 Multisite | 21 | 2019-04-07 |
| 4 | TTS Profile Management | 11 | 2019-07-20 |
| 5 | Introduction to Drupal | 10 | 2020-03-05 |
| 6 | Drupal Multisite on a Dime | 15 | 2020-12-03 |
| 7 | DrupalCon 2022 Code+ Presentation | 43 | 2022-04-07 |
| 8 | What I did at DrupalCon 2022 | 7 | 2022-05-04 |

**Total: 129 slides**

### Content Characteristics

- **Professional/Educational**: Drupal, technology, DevOps topics
- **Interactive elements**: Some include links, images, code snippets
- **Markdown-based**: All use standard Markdown syntax (with Reveal.js/Slidev extensions)

## Troubleshooting

### Presentations Not Rendering

**Problem**: Custom HTML export shows raw markdown

**Solution**: Use Slidev directly
```bash
npm run presentations:dev
# Then export from Slidev UI
```

### Images Not Displaying

**Problem**: Image paths are relative

**Solution**: Ensure assets are in `slidev-presentations/public/` or use absolute URLs

### Performance Issues

**Problem**: Presentations lag during navigation

**Solution**:
- Use Slidev's built-in optimization
- Compress images before adding
- Deploy on CDN for global reach

## Best Practices Going Forward

1. **Keep presentations separate** - Don't merge back into blog build
2. **Use standard Slidev** - Don't create custom converters
3. **Deploy independently** - Netlify/Vercel recommended
4. **Version in Git** - Track presentation changes separately
5. **Link from blog** - Reference presentations from blog posts
6. **Document changes** - Keep this file updated

## References

- Slidev Documentation: https://sli.dev/
- GitHub Slides Export: https://sli.dev/guide/exporting.html
- Reveal.js (original library): https://revealjs.com/

## Summary

**Current Setup**: Option 2 - Standalone Slidev deployment

**Recommended Action**: Deploy `slidev-presentations/` to Netlify or Vercel, link from main blog

**Archive**: `build-presentations.js` kept for reference but no longer part of main build pipeline
