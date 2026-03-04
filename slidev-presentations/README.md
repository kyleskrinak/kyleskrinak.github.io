# Presentations

This directory contains source files for presentations that are converted to standalone HTML and integrated into the blog.

## Directory Structure

```
slidev-presentations/
├── slides/           # Slidev markdown source files
│   ├── 00-template.md                           # Template for new presentations
│   ├── 2026-02-22-squarespace-to-astro.md       # Example: Squarespace to Astro migration
│   └── YYYY-MM-DD-your-presentation.md          # Your presentation here
└── README.md
```

## Adding a New Presentation

### 1. Create the Slidev Markdown File

Create a new file in `slides/` following the naming convention: `YYYY-MM-DD-slug.md`

Use the template at `slides/00-template.md` as a starting point:

```markdown
---
theme: default
title: Your Presentation Title
date: YYYY-MM-DD
tags: [tag1, tag2]
---

# Your Title Slide

Subtitle here

---

## Next Slide

Content here

---
```

**Format requirements:**
- YAML frontmatter between `---` delimiters at the top
- Slides separated by `---`
- Standard markdown syntax (headings, lists, code blocks, tables, links, images)

### 2. Add Metadata to presentations.json

Edit `src/data/presentations.json` and add:

```json
{
  "id": "your-slug",
  "title": "Your Presentation Title",
  "date": "YYYY-MM-DD",
  "description": "Brief description of the presentation",
  "type": "conference|technical|meeting",
  "tags": ["tag1", "tag2"]
}
```

### 3. Build the Presentation

**No manual script changes needed!** The `scripts/build-presentations.js` script uses its `discoverPresentations()` helper to automatically find all `.md` files in `slidev-presentations/slides/` and generate HTML files for them.

Make sure:
- Your slide deck file is in `slidev-presentations/slides/`
- Filename follows `YYYY-MM-DD-your-slug.md`
- The `id` in `src/data/presentations.json` matches the generated HTML filename (without extension)
  - Example: for `2026-02-22-squarespace-to-astro.md`, use `id: "2026-02-22-squarespace-to-astro"`

Run the build:

```bash
npm run build:presentations
```

This generates `public/presentations/YYYY-MM-DD-your-slug.html` (matching the source filename)

### 4. Update sitemap.xml

New presentations are NOT automatically discovered by the sitemap generator. After building:

- Open `src/pages/sitemap.xml.ts`
- Find the hard-coded list of `/presentations/*.html` entries
- Add: `"presentations/YYYY-MM-DD-your-slug.html"`

This ensures search engines can discover your presentation.

### 5. Test Locally

```bash
npm run dev
```

Visit: `http://localhost:4321/presentations/YYYY-MM-DD-your-slug/` (matching the HTML filename)

### 6. Commit and Deploy

```bash
git add slidev-presentations/slides/YYYY-MM-DD-your-slug.md
git add public/presentations/YYYY-MM-DD-your-slug.html
git add src/data/presentations.json
git commit -m "feat: add [presentation name]"
```

## Presentation Features

The generated HTML presentations include:

- **Keyboard navigation**: Arrow keys, spacebar
- **Slide counter**: Shows current/total slides
- **Progress bar**: Visual indicator at top
- **Fullscreen mode**: Button to enter fullscreen
- **Mobile responsive**: Works on phones/tablets
- **Custom styling**: Gradient backgrounds, clean typography

## Markdown Support

Supported markdown features:
- Headings (# through #####)
- Bold (**text**) and italic (*text*)
- Lists (ordered and unordered)
- Links [text](url)
- Images ![alt](url)
- Code blocks with syntax highlighting
- Tables
- Horizontal rules (---)

## Presentation Types

- **conference**: Conference talks and presentations
- **technical**: Technical deep-dives and tutorials
- **meeting**: Internal meeting presentations

## Tips

1. **Keep slides focused**: One main point per slide
2. **Use visuals**: Images and diagrams are more engaging than text
3. **Test responsiveness**: Check on mobile devices
4. **Limit text**: Bullet points should be concise
5. **Use code sparingly**: Only include essential code snippets

## Troubleshooting

**Presentation doesn't appear in the list:**
- Check that metadata is added to `src/data/presentations.json`
- Verify the `id` matches the output filename (without .html)

**Build fails:**
- Ensure the markdown file exists at the specified path
- Check that frontmatter is properly formatted (YAML between ---)
- Verify all `---` slide separators are on their own lines

**Styling looks wrong:**
- The converter uses a fixed gradient theme
- Custom Slidev themes are not supported in the build output
- HTML is generated from markdown, not using Slidev runtime
