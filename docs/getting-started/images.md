# Image Workflow Guide

Complete guide for adding images to the blog, from high-resolution source files to deployed web assets.

## Quick Reference

| Image Type | Source Location | Deployed Location | Used For |
|------------|----------------|-------------------|----------|
| Blog featured images | `/design/screenshots/` | `src/assets/images/` | Post frontmatter |
| Graphics/hero images | `/design/graphics/` | `src/assets/images/` | Visual content |
| Icons | `/design/icons/` | `src/assets/icons/` | UI elements |
| Static assets | `/design/` subdirs | `public/assets/` | Direct links |

## Complete Workflow

### 1. Save High-Resolution Source

Save your original, high-resolution files to `/design/`:

```bash
/design/
├── screenshots/    # Blog post images, mockups
├── graphics/       # Hero images, banners
├── icons/          # Icon source files
└── logos/          # Logo source files
```

**Supported formats for sources:**
- GIMP: `.xcf`
- Photoshop: `.psd`
- Illustrator: `.ai`
- Sketch: `.sketch`
- Figma: Export to design/
- PNG/JPG: High-res originals

**Naming convention:**
```
YYYY-MM-DD-descriptive-name.ext
```

**Examples:**
- `2026-03-02-homepage-mockup.xcf`
- `2026-02-15-conference-screenshot.png`

### 2. Optimize for Web

Export production-ready images optimized for web delivery.

#### Recommended Dimensions

| Use Case | Max Width | Max Height | Notes |
|----------|-----------|------------|-------|
| Blog featured images | 1200px | 630px | For social sharing (Open Graph) |
| Inline content images | 800px | - | Responsive, will scale down |
| Thumbnails | 400px | 400px | Small previews |
| Icons | 96px | 96px | UI elements |

#### Format Recommendations

| Format | Best For | Quality Setting |
|--------|----------|-----------------|
| **WebP** | Photos, complex graphics | 80-85% |
| **PNG** | Screenshots, logos, transparency | - |
| **JPEG** | Photos without transparency | 80-85% |
| **SVG** | Icons, simple graphics | - |

#### Optimization Tools

**Command line (ImageMagick):**
```bash
# Resize and convert to WebP
convert input.png -resize 1200x630 -quality 85 output.webp

# Resize JPEG
convert input.jpg -resize 1200x630 -quality 85 output.jpg

# Optimize PNG
optipng -o7 output.png
```

**GUI tools:**
- **GIMP**: Export → WebP/JPEG with quality slider
- **Photoshop**: Export → Save for Web
- **Squoosh**: https://squoosh.app (online tool)

**Batch optimization:**
```bash
# Install imagemagick if needed
brew install imagemagick

# Batch convert from design/ to src/assets/images/
for file in design/screenshots/*.png; do
  filename=$(basename "$file" .png)
  convert "$file" -resize 1200x630 -quality 85 "src/assets/images/${filename}.webp"
done
```

### 3. Save to Appropriate Location

#### For Blog Featured Images

Save to: **`src/assets/images/`**

```bash
src/assets/images/
└── 2026-03-02-descriptive-name.webp
```

Reference in blog post frontmatter:
```yaml
---
title: "Post Title"
image: ../../assets/images/2026-03-02-descriptive-name.webp
alt: "Descriptive alt text for accessibility"
---
```

#### For Static Assets (Direct Links)

Save to: **`public/assets/`**

```bash
public/assets/
└── my-image.png
```

Reference with absolute path:
```markdown
![Alt text](/assets/my-image.png)
```

Or in HTML:
```html
<img src="/assets/my-image.png" alt="Alt text">
```

**When to use `public/assets/`:**
- Downloaded files (PDFs, zip files)
- Images referenced by external services
- Assets that should not be processed by Astro

#### For Icons

Save to: **`src/assets/icons/`**

Icons are imported in components:
```typescript
import iconName from '../assets/icons/icon-name.svg';
```

### 4. Astro's Automatic Processing

Once images are in `src/assets/images/`, Astro automatically processes them at build time:

#### What Astro Does Automatically

**Image Optimization:**
- Compresses images for optimal file size
- Generates multiple responsive sizes based on component configuration
- Converts to modern formats (WebP with fallbacks for browser compatibility)
- Adds content hashes to filenames for cache busting
- Outputs to `dist/_astro/` directory

**Responsive Images:**
- Creates srcset with multiple resolutions
- Adds appropriate `sizes` attribute for browser selection
- Generates 1x, 2x, 3x versions for different pixel densities
- Automatically serves smallest appropriate size

**Performance Optimizations:**
- Lazy loading (`loading="lazy"`) via rehype plugin
- Async decoding (`decoding="async"`) for non-blocking rendering
- Optimized delivery formats based on browser support

#### Image Service Configuration

Uses **Sharp** (configured in `astro.config.ts`):
- High-quality image processing
- Fast build times
- Support for all common formats (JPEG, PNG, WebP, GIF, SVG)

#### Automatic Image Map

Images in `src/assets/images/` are automatically:
- Imported via glob pattern in `src/lib/images.ts`
- Added to the `imageMap` for component lookup
- **No manual registration needed** - just add files to the directory

#### Build Output Example

**Input:** `src/assets/images/example.jpg` (800 KB)

**Output:** Multiple optimized files in `dist/_astro/`:
```
example-aBc123.webp          (1200px, 120 KB)
example-dEf456.webp          (800px, 80 KB)
example-gHi789.webp          (400px, 45 KB)
example-jKl012.jpg           (fallback, 200 KB)
```

Browser automatically selects best size and format based on viewport and support.

#### Processing Pipeline Summary

```
┌─────────────────────────────────────────────────────────────┐
│ Manual Export                                               │
│ /design/ → src/assets/images/                               │
│ (ImageMagick, GIMP, Squoosh)                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Automatic Import                                            │
│ Glob pattern in src/lib/images.ts                           │
│ No manual registration needed                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Build-Time Processing (Astro + Sharp)                       │
│ • Compress and optimize                                     │
│ • Generate multiple responsive sizes                        │
│ • Convert to WebP + fallbacks                               │
│ • Add content hashes                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Output: dist/_astro/                                        │
│ Multiple optimized versions ready for deployment            │
└─────────────────────────────────────────────────────────────┘
```

### 5. Reference in Content

#### Blog Post Featured Image

In frontmatter:
```yaml
---
title: "My Post"
pubDate: 2026-03-02
image: ../../assets/images/2026-03-02-feature.webp
alt: "Screenshot showing the new feature"
caption: "Optional caption displayed below the image"
---
```

Path explanation:
- From: `src/content/blog/2026-03-02-post.md`
- To: `src/assets/images/2026-03-02-feature.webp`
- Path: `../../` (up two dirs) then `assets/images/filename`

**Open Graph (Social Sharing) Images:**

The `image` field is automatically used as the Open Graph image for social media sharing (Facebook, Twitter, LinkedIn, etc.). When someone shares your post, this image appears in the preview.

**OG Image Priority:**
1. **`ogImage`** field (if you want a different image for social sharing)
2. **`image`** field (hero image, used by default)
3. Dynamic OG image (auto-generated if enabled)
4. Site default (`SITE.ogImage`)

**Example with custom OG image:**
```yaml
---
title: "My Post"
image: ../../assets/images/2026-03-02-hero.webp      # Hero image shown in post
ogImage: ../../assets/images/2026-03-02-social.webp  # Different image for social sharing
alt: "Screenshot showing the new feature"
---
```

**When to use a separate `ogImage`:**
- Hero image is vertical, but social sharing works better with horizontal (1200×630)
- You want text overlay on social image but not on hero image
- Hero image is an SVG but you want a raster OG image

Most posts don't need a separate `ogImage` - the hero image works well for both.

#### Inline Markdown Images

```markdown
![Alt text describing the image](../../assets/images/inline-image.webp)
```

#### HTML Images (for more control)

```html
<img
  src="../../assets/images/image.webp"
  alt="Descriptive alt text"
  width="800"
  height="600"
>
```

## File Size Guidelines

Target file sizes for web delivery:

| Image Type | Target Size | Maximum Size |
|------------|-------------|--------------|
| Featured images | 100-200 KB | 500 KB |
| Inline images | 50-150 KB | 300 KB |
| Thumbnails | 20-50 KB | 100 KB |
| Icons | < 10 KB | 50 KB |

**If your image exceeds these:**
1. Reduce dimensions
2. Lower quality setting (80% is usually imperceptible)
3. Convert to WebP format
4. Remove metadata: `exiftool -all= image.jpg`

## Accessibility Requirements

**Always provide alt text:**

✅ **Good alt text:**
```yaml
alt: "Screenshot of the Astro homepage showing the hero section with 'Build fast websites' tagline"
```

❌ **Poor alt text:**
```yaml
alt: "Screenshot"
alt: "Image"
alt: ""  # Never empty
```

**Alt text guidelines:**
- Describe what's in the image
- Be specific and concise
- Don't start with "Image of..." or "Picture of..."
- For decorative images, use `alt=""` in HTML (not in frontmatter)

## Version Control

**What to commit:**
- ✅ Production images in `src/assets/images/`
- ✅ Production images in `public/assets/`
- ✅ Source files in `/design/` (if reasonable size)

**What NOT to commit:**
- ❌ Very large source files (> 10 MB)
- ❌ Temporary exports
- ❌ Build artifacts in `dist/`

**For large source files:**
Use Git LFS or store externally:
```bash
# Add to .gitignore
echo "design/**/*.psd" >> .gitignore
echo "design/**/*.xcf" >> .gitignore
```

## Common Workflows

### Workflow 1: Blog Post Screenshot

1. Capture screenshot → Save to `design/screenshots/2026-03-02-my-screenshot.png`
2. Open in GIMP/Photoshop
3. Crop to 1200×630 (or desired aspect ratio)
4. Export as WebP (85% quality) → `src/assets/images/2026-03-02-my-screenshot.webp`
5. Add to post frontmatter:
   ```yaml
   image: ../../assets/images/2026-03-02-my-screenshot.webp
   alt: "Description of what the screenshot shows"
   ```

### Workflow 2: Inline Content Image

1. Save high-res to `design/graphics/2026-03-02-diagram.png`
2. Export at 800px width → `src/assets/images/2026-03-02-diagram.webp`
3. Reference in markdown:
   ```markdown
   ![Diagram showing the architecture](../../assets/images/2026-03-02-diagram.webp)
   ```

### Workflow 3: Static Asset (PDF, Download)

1. Save file to `public/assets/my-document.pdf`
2. Link in markdown:
   ```markdown
   [Download PDF](/assets/my-document.pdf)
   ```

## Troubleshooting

### Image not showing in development

**Check:**
1. Path is correct: `../../assets/images/filename.ext`
2. File exists in `src/assets/images/`
3. Extension matches exactly (case-sensitive)
4. Image is automatically imported via glob pattern (check `src/lib/images.ts`)
5. Restart dev server if you just added the image: `npm run dev`

**Note:** After adding a new image to `src/assets/images/`, it's automatically available in the `imageMap`. No manual registration needed.

### Image looks pixelated

**Fix:**
- Export at higher resolution (2× for retina displays)
- Use WebP format for better quality at same file size
- Check source image quality

### Image file size too large

**Optimize:**
```bash
# Reduce dimensions
convert input.jpg -resize 1200x630 output.jpg

# Lower quality
convert input.jpg -quality 80 output.jpg

# Convert to WebP
convert input.jpg -quality 85 output.webp
```

### Build fails with image error

**Common causes:**
1. Image path in frontmatter is incorrect
2. Image file doesn't exist
3. Image file name has special characters (use `-` not spaces)
4. Missing `alt` text in frontmatter

## Examples from Existing Posts

See these posts for reference:

```bash
# Featured images examples
grep "image:" src/content/blog/*.md | head -5

# Inline image examples
grep "!\[" src/content/blog/*.md | head -5
```

## Best Practices

1. **Name files descriptively**: `2026-03-02-homepage-redesign.webp` not `IMG_1234.jpg`
2. **Optimize before committing**: Export at target dimensions and quality before adding to `src/assets/images/`
3. **Let Astro handle format conversion**: Export as JPEG or PNG, Astro will generate WebP + fallbacks automatically
4. **Keep sources in `/design`**: Preserve originals for future edits
5. **Always add alt text**: Required for accessibility
6. **Test locally first**: Preview images before pushing
7. **Use consistent dimensions**: 1200×630 for featured images
8. **No manual registration needed**: Just add images to `src/assets/images/` - they're automatically imported

## Quick Commands

```bash
# Find all images in blog posts
grep -r "image:" src/content/blog/

# Check image file sizes
du -sh src/assets/images/*

# List recent images
ls -lt src/assets/images/ | head -10

# Optimize all PNGs
optipng -o7 src/assets/images/*.png

# Convert batch to WebP
for f in src/assets/images/*.jpg; do
  cwebp -q 85 "$f" -o "${f%.jpg}.webp"
done
```

---

**Next steps:**
- See [Creating Posts](./creating-posts.md) for full blog post workflow
- Check [File Structure](./file-structure.md) for project organization
- Review existing images in `src/assets/images/` for examples
