# Resume Source and Data Flow

The resume lives in exactly one file: `src/content/pages/resume/index.md`. Its frontmatter holds structured career data; its body holds hand-written prose. Everything downstream — the web page, the print route, the canonical PDF, the content linter, and every tailored variant — reads that one file.

This document records **which field populates which output**, so a future edit does not have to infer the architecture from the code. For how a revision proceeds — editing cadence, register, the one-page constraint, and which calls are Kyle's — see the `resume-workflow` skill in `.claude/skills/`.

**The governing invariant: one source, two renderings.** The web page and the print output derive from the same file. A change that lands in one and not the other is a defect, not a variation.

## Why the frontmatter exists

The resume gets revisited quarterly. Structured fields exist so a quarterly edit changes a fact in **one** place and every render follows. They are not a duplicate of the body text awaiting cleanup.

Commit `dc8069e` deleted `current_role`, `skills_inventory`, `education`, and the change log while moving certifications out to `scripts/data/certifications.json`. **Only the certifications move was intended.** The other four deletions were accidental and were restored on 2026-10-05. Do not "clean up" these fields as redundant — the sections below are what reads them.

## Placeholder expansion

The body carries top-level HTML comment placeholders where a data-driven section belongs:

```markdown
<!-- current-role -->

Lead a team of 12 offshore IT contractors… <!-- f: leadership, platform-ops -->

- Cut Azure hosting run-rate 24.5%… <!-- f: cost, platform-ops -->

## Senior Manager, IT
…
<!-- education -->
```

`src/lib/resume-sections.mjs` is the single renderer. It is pure — no `fs`, no `yaml` — so both the Astro build and the Node scripts import the same code:

| Consumer | Path in | How it expands |
|---|---|---|
| `/resume/`, `/resume/print/`, the canonical PDF | `src/lib/remark-resume-sections.mjs` | A remark plugin replaces each placeholder node with MDAST parsed from the renderer's markdown. |
| `lint-resume.mjs`, `resume-render.mjs` (PDF verification), `build-resume-variant.mjs` (entry-id derivation) | `scripts/lib/resume-source.mjs` | `readResumeSource()` returns `{ data, body, expandedBody }`. |

**One expansion, four consumers.** Both paths run the same renderer over the same markdown string, so the page, the PDF verifier, the linter, and the variant builder's anchor ids cannot disagree about what a section says. A consumer that read the raw `body` instead of `expandedBody` would lose headings silently — PDF verification is inclusion-based (`haystack.includes(text)`), so a missing expectation weakens the check without failing it.

The remark plugin runs **first** in `astro.config.ts`'s `remarkPlugins`, before `remarkDirective`, and is inert on every other page.

### Adding a placeholder section

1. Add the name to `RESUME_SECTIONS` in `src/lib/resume-sections.mjs`.
2. Write its renderer, returning markdown. Throw on missing required data rather than returning a partial section.
3. Register it in `RENDERERS` and extend `renderResumeSection()`'s dispatch.
4. Add the field to the `pages` schema in `src/content.config.ts`.
5. Add tests to `tests/unit/resume-sections.test.mjs`.

A placeholder-shaped comment whose name is not in `RESUME_SECTIONS` (`<!-- educaton -->`) **throws**, so a typo fails the build instead of rendering nothing. Facet tags (`<!-- f: … -->`) and prose comments stay inert.

## Field-by-field: what populates what

### `current_role` — injected, four consumers

| Output | Where |
|---|---|
| The resume's lead `## ` heading and employer line | `<!-- current-role -->` |
| The `/resume/` meta description | `resumeMetaDescription()` in `src/pages/resume.astro` |
| The `/resume/print/` meta description | the same function in `src/pages/resume/print/index.astro` |
| The About page's current-position sentence | `src/pages/about.astro` reads the resume entry via `getEntry("pages", "resume")` |

Changing the job title in frontmatter changes all four. Before this wiring, `about.astro` carried its own hand-typed copy, and the two drifted.

`location` and `start_date` are required: the employer-line convention is `**Employer** — Location | Dates`, and both `resume-render.mjs` (which matches employers on the em dash) and `lint-resume.mjs` (which identifies the line by its pipe and digits) stop recognizing a line that is missing either.

### `education` — injected

`<!-- education -->` renders one section per item whose `render` flag is `true`. The heading uses `degree_abbr` when present, falling back to the formal `degree` — so `M.S. I.T.` prints on the resume while the full degree name stays available in the data.

`render` defaults to `false` in the schema, so an item is opt-in. Zero rendered items expands to nothing (an explicit opt-out). A **missing `education` object** throws, because the placeholder then points at data that does not exist.

The opt-in default is deliberate, and it is why the field is a boolean rather than an implicit "render everything present." Kyle pursues ongoing coursework, and whether a given item *belongs* on the resume is a judgment call raised during a revision — not a settled property of the data. `render: false` records an item without printing it, so the metadata stays complete while the rendered resume stays selective.

github-slugger derives variant entry ids from these headings, which is why `ms-it` is a valid `anchor_before_id`.

### `skills_inventory` — a reservoir, drawn on by variants

The nine categories are **not** rendered on the public resume. They are the bank a tailored variant draws from: a variant config's `include_skills` selects categories by id and the builder injects a Skills section. See [Resume Variants](./resume-variants.md).

`last_reviewed` is the quarterly-review marker, maintained by hand.

### `description` — the career summary only

`resumeMetaDescription()` composes the meta description as `current_role.title` + `". "` + `description`. The role sentence therefore must **not** be repeated in `description`; that field carries only the career summary no structured field can derive.

### `changelog` — a record, not a render

Nothing renders it. It documents what changed and why, which is how the `dc8069e` accident above is now traceable from the source file itself.

### Certifications — deliberately not in this file

Certification data lives in `scripts/data/certifications.json`, by decision. **Keep certification information out of the resume source.** Variants inject certs from that file; the published resume shows none.

## Two vocabularies, deliberately separate

| Vocabulary | Where defined | Count | Purpose |
|---|---|---|---|
| `FACETS` | `src/lib/remark-facets.mjs` | 7 | Tags body bullets and scope paragraphs (`<!-- f: leadership, cost -->`) so variants can filter them. |
| `skills_inventory.categories[].id` | the resume frontmatter | 9 | Names a block of skills a variant can inject. |

These overlap in wording (`leadership`, `platform-ops`) and **are not the same list**. A facet answers "does this bullet belong in this variant?"; a category id answers "which skills block do I add?" Do not reconcile them, and do not validate one against the other.

## Quarterly review

A revision is warranted by a role or title change, a new certification, a completed project worth citing, or the quarterly staleness check. That last one is automated: `.github/workflows/resume-review-reminder.yml` opens an issue at each quarter start, and the issue is the trigger — a session should not also flag staleness on its own. Its checkboxes map to this file:

| Checkbox | What to edit |
|---|---|
| Update achievements and metrics | body bullets, with `<!-- f: … -->` tags |
| Review skills inventory and last-reviewed date | `skills_inventory` |
| Check certifications for expiry | `scripts/data/certifications.json` |
| Verify the change log entry | `changelog` |
| Confirm web and print renders match | `npm run build`, then review `/resume/` and the PDF |

## Verifying a change

```bash
npm run build        # runs lint-resume.mjs, then astro build
npm run test:unit    # resume-sections and resume-variant suites
```

A frontmatter change that should not alter the rendered text can be proved byte-for-byte by diffing `readResumeSource().expandedBody` against the committed body.
