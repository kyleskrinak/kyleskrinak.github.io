# Creating New Blog Posts

Quick cheat sheet for writing new blog posts in Astro.

## File Location

Each post is a directory under **`src/content/blog/`** containing an `index.md` (or `index.mdx`) and any images the post uses:

```
src/content/blog/2026-01-20-my-first-astro-post/
├── index.md
└── hero.webp        # optional
```

## Slug Convention

Use this format for the directory name:
```
YYYY-MM-DD-post-slug
```

**Examples:**
- `2026-01-20-my-first-astro-post`
- `2026-01-15-a-great-day`
- `2026-01-10-learning-astro`

The directory name is the slug — it becomes part of the URL. For `2026-01-20-my-first-astro-post/index.md`:
- URL: `https://kyle.skrinak.com/posts/2026-01-20-my-first-astro-post/`

Slug must be lowercase letters, digits, and hyphens. Wrong case causes 404s on Linux CI even if macOS hides it locally.

## Scaffold with `npm run new-post`

The fastest way to create a new post is:

```bash
# Stub only
npm run new-post -- 2026-01-20-my-first-astro-post

# Stub plus images (converts JPG/PNG to WebP, max 1200px)
npm run new-post -- 2026-01-20-my-first-astro-post --images ~/Desktop/post-images
```

This creates the directory, writes `index.md` with a minimal frontmatter stub (`title`, today's UTC `pubDate`, empty `tags`, `published: false`), and — with `--images` — copies/converts images into the post directory and wires the first one in as the hero. See [Image Workflow Guide](./images.md) for details.

## Frontmatter (Metadata)

Every post needs frontmatter at the top. Copy this template:

```yaml
---
title: "Your Post Title Here"
description: "Brief description for search results and meta tags"
pubDate: 2026-01-20  # Date the post was published
updatedDate: 2026-01-20  # Optional: date post was last updated
image: ./post-image.webp  # Optional: featured image (co-located in post dir)
alt: "Alt text for the image"  # Required when image is set
categories: ["astro", "blogging"]  # Optional: topic tags
---
```

## Frontmatter Fields Explained

### Required Fields

| Field | Example | Notes |
|-------|---------|-------|
| `title` | `"Learning Astro"` | Post title (appears in browser tab and listings) |
| `description` | `"A beginner's guide to Astro"` | Used in search results and social media preview |
| `pubDate` | `2026-01-20` | Publication date (YYYY-MM-DD format) |

### Optional Fields

| Field | Example | Notes |
|-------|---------|-------|
| `updatedDate` | `2026-01-20` | Last modified date (shows in post metadata) |
| `image` | `./my-image.webp` | Featured image for post (also used as Open Graph image for social sharing) |
| `alt` | `"A screenshot of code"` | Accessibility text for featured image (required if `image` is set) |
| `caption` | `"Screenshot of the homepage"` | Optional caption displayed below featured image |
| `ogImage` | `./social.webp` | Override: use different image for social sharing (defaults to `image`) |
| `categories` | `["astro", "web"]` | Topic categories for filtering |
| `tags` | `["astro", "tutorial"]` | Tags for filtering and discovery |

## Complete Frontmatter Example

```yaml
---
title: "Building a Blog with Astro"
description: "Learn how to set up a fast, modern blog using Astro static site generator"
pubDate: 2026-01-20
updatedDate: 2026-01-21
image: ./astro-blog.webp
alt: "Astro logo and code editor"
categories: ["astro", "web development", "tutorial"]
---
```

## Post Content

After the closing `---` of frontmatter, write your post in **Markdown**:

```markdown
---
title: "Your Title"
description: "Your description"
pubDate: 2026-01-20
---

# Heading 1

This is a paragraph. You can use **bold**, *italic*, or `code`.

## Heading 2

- Bullet point 1
- Bullet point 2
- Bullet point 3

### Heading 3

1. Numbered point
2. Another point
3. Final point

[Link text](https://example.com)

![Image alt](./example.webp)
```

## Adding Images

### Quick Reference

**Store images in:** the post directory, alongside `index.md`.

**Reference with relative path:** `./image-name.webp`.

**Preferred format:** WebP. The `npm run new-post --images <dir>` flow converts JPG/PNG to WebP automatically. For images you add manually, see the conversion snippets in the Image Workflow Guide.

**Featured image in frontmatter:**
```yaml
image: ./my-image.webp
alt: "Descriptive alt text"
```

**Inline image in content:**
```markdown
![Alt text](./my-image.webp)
```

### Complete Image Workflow

**See [Image Workflow Guide](./images.md)** for:
- The `npm run new-post` scaffold
- Per-post co-location pattern and gallery sub-directories
- MDX `<Image>` usage when you need width/height/figure markup
- Recommended dimensions, formats, and size targets
- Troubleshooting image issues

## Markdown Features Supported

### Code Blocks

````markdown
```javascript
function helloWorld() {
  console.log("Hello from Astro!");
}
```
````

Specify the language: `javascript`, `python`, `bash`, `html`, `css`, etc.

### Headings

```markdown
# H1 - Main title (don't use in posts, title is in frontmatter)
## H2 - Section heading
### H3 - Subsection
#### H4 - Sub-subsection
```

### Lists

Unordered:
```markdown
- Item 1
- Item 2
  - Nested item
```

Ordered:
```markdown
1. First
2. Second
3. Third
```

### Blockquotes

```markdown
> This is a blockquote.
> Can span multiple lines.
```

### Links

```markdown
[Link text](https://example.com)
[Internal link](/posts/another-post/)
```

### Code inline

```markdown
Use `backticks` for inline code
```

## Publishing a Post

### 1. Create the post

```bash
npm run new-post -- YYYY-MM-DD-slug
```

Then edit `src/content/blog/YYYY-MM-DD-slug/index.md`. Or, scaffold straight from a folder of images:

```bash
npm run new-post -- YYYY-MM-DD-slug --images ~/Desktop/post-images
```

### 2. Test locally

```bash
npm run dev
```

Visit `http://localhost:4321` and check your post appears:
- In the blog listing
- At the correct URL (`/posts/YYYY-MM-DD-slug/`)
- With correct formatting

### 3. Check for errors

Open DevTools (F12) and check:
- ✅ No console errors
- ✅ Images load correctly
- ✅ Links work
- ✅ Formatting looks right

### 4. Run tests (optional)

```bash
npm run test:console
```

### 5. Commit and push

```bash
git add src/content/blog/2026-01-20-your-post/
git commit -m "blog: Add new post about your topic"
git push origin staging  # Test on staging first
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Wrong date format in slug | Use `YYYY-MM-DD` not `YY-M-D` |
| Wrong frontmatter format | Use YAML (colons, not equals) |
| Image path uses `../../assets/…` | Old layout. Use `./name.webp` — images co-locate in the post directory |
| Uppercase letters in slug | Slug must be lowercase. Wrong case 404s on Linux CI |
| Spaces in image filenames | Rename to `kebab-case.webp` — JS imports and URLs both fail otherwise |
| Missing `pubDate` | Required field - must be present |
| Missing `alt` when `image` is set | Schema rejects this. Add a descriptive `alt:` |
| Extra spaces in YAML | YAML is whitespace-sensitive - check indentation |

## Post Ideas

Posts you could write:

- Tech tutorials or how-tos
- Learning notes or reflections
- Project case studies
- Travel stories
- Book or article reviews
- Updates on what you're working on

See existing posts for examples of style and tone.

## Need Help?

- **Markdown syntax**: [CommonMark Spec](https://spec.commonmark.org/)
- **Astro docs**: [astro.build](https://astro.build/)
- **Image handling**: See [Image Workflow Guide](./images.md)
- **Existing posts**: Check `src/content/blog/` for reference

---

**Quick checklist before publishing:**
- [ ] Frontmatter has `title`, `description`, `pubDate`
- [ ] Directory is `src/content/blog/YYYY-MM-DD-slug/`
- [ ] Images are co-located in the post directory and referenced as `./name.webp`
- [ ] `alt` is set whenever `image` is set
- [ ] Post tested locally with `npm run dev`
- [ ] No console errors
- [ ] Links and images working
- [ ] Pushed to staging first for review
