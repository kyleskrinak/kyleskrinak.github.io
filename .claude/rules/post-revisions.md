---
paths:
  - "src/content/blog/**"
---

# Post Revisions

When making content edits to a previously-published post (one published before the current session), apply BOTH:

1. **Frontmatter** — add `updatedDate: YYYY-MM-DDTHH:MM:SS.000Z` (today's date, UTC). Drives the "Revised on:" label and RSS `pubDate` update; does NOT affect sort order (original `pubDate` controls ordering).

2. **Inline marker at each change point** — plain italic line directly after the affected paragraph:
   ```markdown
   *Revised YYYY-MM-DD: brief description of what changed.*
   ```

**Note:** This Astro setup does NOT support Kramdown attribute syntax (`{: .class}`). Use plain markdown italic.
