# Image Workflow Guide

How images are organized, processed, and referenced in posts.

## The model: per-post co-location

Every blog post lives in its own directory. Images for the post live alongside `index.md`:

```
src/content/blog/2026-05-25-example-post/
├── index.md          # or index.mdx if you need raw <img> blocks
├── hero.webp
├── inline-1.webp
└── gallery/          # optional sub-dir for multi-image groups
    ├── photo-1.webp
    └── photo-2.webp
```

Frontmatter and body reference images by relative path (`./hero.webp`). Astro's content schema runs every image field through its `image()` helper, so paths resolve to typed `ImageMetadata`, Sharp processes them at build time, and the output lands in `dist/_astro/` with content hashes and responsive variants.

There is no `src/assets/images/` and no `public/assets/`. Both are gone. New images go into the post directory that uses them. An image referenced by multiple posts is duplicated (it's cheap, and it keeps each post self-contained).

## The fast path: `npm run new-post`

Scaffold a new post with one command:

```bash
# Stub only
npm run new-post -- 2026-05-25-my-new-post

# Stub + images from a source directory
npm run new-post -- 2026-05-25-my-new-post --images ~/Desktop/post-images
```

What it does:

- Creates `src/content/blog/<slug>/index.md` with title, today's UTC `pubDate`, empty `tags`, and `published: false`.
- With `--images <dir>`: copies each image into the post directory. JPG/PNG are converted to WebP (quality 85, resized to a maximum 1200 px width). WebP, SVG, GIF, and AVIF pass through unchanged. The first image becomes the frontmatter `image:`, the rest are appended as inline `![alt](./name)` references.

Slug rules: lowercase letters, digits, and hyphens. `2026-05-25-` date prefix is conventional but not required by the script.

Source: `scripts/new-post.mjs`.

## Manual workflow

If you already have a post directory and want to add an image by hand:

1. Drop the image into the post directory (use a descriptive lowercase-kebab filename — no spaces).
2. If it's a JPG or PNG larger than 1200 px on the long side, convert it to WebP first. There's no automation outside `npm run new-post` for this; use whichever tool you prefer:
   ```bash
   # Sharp (already a project dep)
   node -e "require('sharp')('input.jpg').resize({width:1200,withoutEnlargement:true}).webp({quality:85}).toFile('output.webp')"

   # cwebp
   cwebp -q 85 input.jpg -o output.webp

   # ImageMagick
   convert input.jpg -resize '1200x>' -quality 85 output.webp
   ```
3. Reference it from the post (see below).

## Referencing images from a post

### Frontmatter (hero / social card)

```yaml
---
title: My post
pubDate: 2026-05-25
image: ./hero.webp
alt: Descriptive alt text for the hero image
caption: Optional caption rendered below the image
---
```

Schema fields (defined in `src/content.config.ts`):

| Field | Purpose |
|-------|---------|
| `image` | On-page hero. Also the default Open Graph card. |
| `heroImage` | Alternate hero slot. Same `image()` resolution. |
| `ogImage` | Social-only override (e.g., 1200×630 raster of an SVG hero). |
| `alt` | Required when `image` or `heroImage` is set (accessibility). |
| `caption` | Optional caption text below the hero image. |
| `imagePosition` | Optional crop hint (`top`, `center`, `entropy`, etc.). |

### Markdown body

```markdown
![Alt text](./inline-1.webp)

![Alt text](./gallery/photo-1.webp)
```

Both Astro and the `image()` helper resolve these — same Sharp pipeline as the frontmatter.

### MDX body (raw HTML or `<Image>` control)

If you need width/height attributes, `<figure>`/`<figcaption>` markup, or float layouts, rename the file to `index.mdx` and import the image:

```mdx
---
title: My post
pubDate: 2026-05-25
---
import { Image } from "astro:assets";
import hero from "./hero.webp";

<figure>
  <Image src={hero} alt="Descriptive alt text" />
  <figcaption>Caption here</figcaption>
</figure>
```

MDX has one gotcha: CSS `{ }` inside `<style>` blocks parses as JSX and breaks the build. Don't inline `<style>` tags in `.mdx` files — put styles in a layout's scoped CSS instead.

## Source files (`/design/`)

`/design/` is for high-resolution originals and editable source files that are not deployed:

```
/design/
├── screenshots/    # Raw screenshots before crop/resize
├── graphics/       # Hero artwork, diagrams
├── icons/          # Icon source files
└── logos/          # Logo masters
```

Use whatever naming you like, but `YYYY-MM-DD-descriptive-name.ext` is the established convention. Source formats: `.xcf` (GIMP), `.psd` (Photoshop), `.ai` (Illustrator), `.svg`, high-res `.png`/`.jpg`.

Keep originals; export web-ready copies into the post directory.

## File size & dimension guidelines

| Use case | Target dimensions | Target file size |
|----------|------------------|------------------|
| Hero / featured | 1200×630 (16:9-ish) | 100–200 KB |
| Inline content | ≤ 800 px wide | 50–150 KB |
| Thumbnails | 400×400 | 20–50 KB |
| Icons | 96×96 | < 10 KB |

`npm run new-post --images <dir>` already caps the long edge at 1200 px and converts to WebP at quality 85, which lands in the target range for most photos. If a manually-added image is too large after that, reduce dimensions before lowering quality — q80 is usually still imperceptible, but resizing wins more bytes.

Strip EXIF if it matters:
```bash
exiftool -all= image.webp
```

## Accessibility

The schema enforces `alt` whenever an on-page `image` or `heroImage` is set. The build fails without it.

Good alt text describes what's in the image:

```yaml
alt: Screenshot of the Astro homepage, hero section, "Build fast websites" tagline visible
```

Not:

```yaml
alt: Screenshot     # too vague
alt: Image of …     # don't start with "Image of"
alt: ""             # never empty (use a decorative-image pattern in MDX if truly decorative)
```

## Version control

Commit:

- Post directories under `src/content/blog/<slug>/` including their images.
- `/design/` originals if reasonably sized (< ~5 MB each).

Don't commit:

- Source files > 10 MB (add to `.gitignore` or store externally).
- Build artifacts (`dist/`, `.astro/`).
- Temporary exports.

## Guardrails

A pre-commit hook (Husky) and the `build:ci` script both run `scripts/check-image-conventions.mjs`:

- New files under `public/assets/` → **blocked**.
- Post markdown matching `src="/assets/…"` or `](../../assets/images/…` → **blocked**.
- Post-co-located images > 500 KB → warned.
- JPG/PNG inside a post directory (without `.original.{jpg,png}` suffix) → warned (suggest WebP).

Run it manually any time:

```bash
npm run check:images
```

If a commit is blocked, fix the file rather than bypassing — these all map to real failure modes (raw-served images skip Sharp, oversized images break LCP, JPG/PNG are usually fixable with `cwebp`). Emergency bypass: `git commit --no-verify`.

## Troubleshooting

**Image not showing in dev.**
- Path correct? Frontmatter uses `./name.ext`, not `../../assets/…`.
- File exists in the post directory with that exact case (Linux CI is case-sensitive; macOS hides this).
- Filename has no spaces. `in memorandum.svg` won't import — rename to `in-memorandum.svg`.
- Restart `npm run dev` if you added the file while the server was running.

**Build fails with "alt is required".**
The schema requires `alt` whenever `image` or `heroImage` is set. Add a descriptive `alt:` field.

**MDX build fails on `{` or `}`.**
You have a `<style>` block, an inline JSX expression with literal braces, or a curly-brace character in body text. Strip the `<style>` block (move styles into a layout) or escape braces with `&lbrace;` / `&rbrace;`.

**Same image needed in two posts.**
Copy it into both post directories. Sharing via a central directory was the old model — don't reintroduce it.

**Working with shared presentation assets, not blog content.**
`public/presentations/assets/` exists for the four standalone presentation HTML files. Blog content does not go there.

## Quick references

```bash
# All hero images currently in use
grep -rh "^image:" src/content/blog/*/index.md{,x} | sort -u

# All inline images currently referenced
grep -rh "!\[.*\](\./" src/content/blog/*/index.md{,x}

# Find oversized images
find src/content/blog -name '*.webp' -size +500k -ls
find src/content/blog \( -name '*.jpg' -o -name '*.jpeg' -o -name '*.png' \) -size +500k -ls
```

---

**Related:**
- [Creating Posts](./creating-posts.md) — full post workflow
- [File Structure](./file-structure.md) — project layout
- `src/content.config.ts` — schema source of truth
- `scripts/new-post.mjs` — scaffold script
