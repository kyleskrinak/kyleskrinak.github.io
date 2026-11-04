---
paths:
  - "src/content/pages/resume/index.md"
  - "src/lib/resume-*"
  - "scripts/**/*resume*"
  - "src/pages/resume.astro"
  - "src/pages/resume/**"
  - "src/content/pages/about.mdx"
  - "src/components/CurrentRole.astro"
---

# Resume Source

**Before editing `src/content/pages/resume/index.md`, any `src/lib/resume-*`, `scripts/*resume*`, `src/pages/resume*`, `src/content/pages/about.mdx`, or `src/components/CurrentRole.astro`, read `docs/features/resume-source.md`.** It records which frontmatter field populates which output. Do not infer that architecture from the code, and do not propose deleting a structured field as a duplicate of the body text — the resume is revised quarterly, and those fields exist so one edit reaches every render.

Three facts that have been guessed wrong before:
- `current_role` populates the resume's lead heading, both meta descriptions, and the About page sentence. None of those are hand-typed.
- `skills_inventory` (9 category ids) and `FACETS` (7 bullet tags, `src/lib/remark-facets.mjs`) are **separate vocabularies**. Do not reconcile or cross-validate them.
- No certifications on any resume, variants included (Manager Tools; see `docs/references/manager-tools-rubric.md`).
