---
paths:
  - "src/content/posts/**"
---

# Post Revisions

When making content edits to a previously-published post (one published before the current session), apply BOTH:

1. **Frontmatter** — add `modDatetime: YYYY-MM-DDTHH:MM:SS.000Z` (today's date, UTC). Drives the "Revised on:" label and the RSS item date. It doesn't change the sort order: the site's `getSortedPosts` sorts by `pubDatetime` (a `SITE-OVERRIDE` of upstream's `modDatetime ?? pubDatetime`), so a revised post keeps its place in the post lists.

2. **Inline marker at each change point** — plain italic line directly after the affected paragraph:
   ```markdown
   *Revised YYYY-MM-DD: brief description of what changed.*
   ```

**Note:** This Astro setup does NOT support Kramdown attribute syntax (`{: .class}`). Use plain markdown italic.
