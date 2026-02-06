# Creating New Blog Posts

Quick cheat sheet for writing new blog posts in Astro.

## File Location

All blog posts go in: **`src/content/blog/`**

## File Naming Convention

Use this format:
```
YYYY-MM-DD-post-slug.md
```

**Examples:**
- `2026-01-20-my-first-astro-post.md`
- `2026-01-15-a-great-day.md`
- `2026-01-10-learning-astro.md`

The filename becomes part of the URL. For `2026-01-20-my-first-astro-post.md`:
- URL: `https://kyle.skrinak.com/posts/2026-01-20-my-first-astro-post/`

## Frontmatter (Metadata)

Every post needs frontmatter at the top. Copy this template:

```yaml
---
title: "Your Post Title Here"
description: "Brief description for search results and meta tags"
pubDate: 2026-01-20  # Date the post was published
updatedDate: 2026-01-20  # Optional: date post was last updated
image: "../../assets/images/post-image.jpg"  # Optional: featured image
alt: "Alt text for the image"  # Description for accessibility
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
| `image` | `"../../assets/images/my-image.jpg"` | Featured image for post |
| `alt` | `"A screenshot of code"` | Accessibility text for featured image |
| `categories` | `["astro", "web"]` | Topic categories for filtering |

## Complete Frontmatter Example

```yaml
---
title: "Building a Blog with Astro"
description: "Learn how to set up a fast, modern blog using Astro static site generator"
pubDate: 2026-01-20
updatedDate: 2026-01-21
image: "../../assets/images/astro-blog.jpg"
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

![Image alt](../../assets/images/example.jpg)
```

## Adding Images

### Store images locally

Put images in: **`src/assets/images/`**

Filename format: `YYYY-MM-DD-descriptive-name.jpg`

Example: `2026-01-20-astro-logo.jpg`

**Note**: For graphic source files (PSD, AI, Sketch, etc.), store them in `/design` instead. Only production-ready, optimized images belong in `src/assets/images/`.

### Reference images in posts

From a post in `src/content/blog/`:

```markdown
![Alt text](../../assets/images/2026-01-20-my-image.jpg)
```

The `../../` goes up two directories to reach `src/`, then into `assets/images/`.

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

### 1. Create the file

Create `src/content/blog/YYYY-MM-DD-slug.md` with your frontmatter and content.

### 2. Test locally

```bash
npm run dev
```

Visit `http://localhost:3000` and check your post appears:
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
git add src/content/blog/2026-01-20-your-post.md
git commit -m "blog: Add new post about your topic"
git push origin staging  # Test on staging first
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Wrong date format in filename | Use `YYYY-MM-DD` not `YY-M-D` |
| Wrong frontmatter format | Use YAML (colons, not equals) |
| Image path too many `../../` | Count directories: `src/content/blog` is 2 up from `src` |
| Image path with quotes inside quotes | Use single quotes around path in markdown |
| Missing `pubDate` | Required field - must be present |
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
- **Image handling**: See `src/assets/images/` for examples
- **Existing posts**: Check `src/content/blog/` for reference

---

**Quick checklist before publishing:**
- [ ] Frontmatter has `title`, `description`, `pubDate`
- [ ] Filename is `YYYY-MM-DD-slug.md`
- [ ] Images are in `src/assets/images/`
- [ ] Post tested locally with `npm run dev`
- [ ] No console errors
- [ ] Links and images working
- [ ] Pushed to staging first for review
