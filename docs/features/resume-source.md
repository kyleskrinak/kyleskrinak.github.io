# Resume Source and Data Flow

The resume lives in exactly one file: `src/content/pages/resume/index.md`. Its frontmatter holds structured career data; its body holds hand-written prose. Everything downstream — the web page, the print route, the canonical PDF and its .docx and .txt copies, the content linter, and every tailored variant — reads that one file. One render of the print route writes all three files: the PDF prints the page, and `scripts/lib/resume-formats.mjs` reads the .docx and .txt content out of the same laid-out page, so the three cannot disagree.

This document records **which field populates which output**, so a future edit does not have to infer the architecture from the code. For how a revision proceeds — editing cadence, register, the one-page constraint, and which calls are Kyle's — see the `resume-workflow` skill in `.claude/skills/`.

**The governing invariant: one source, two renderings.** The web page and the print output derive from the same file. A change that lands in one and not the other is a defect, not a variation.

## Why the frontmatter exists

The resume gets revisited quarterly. Structured fields exist so a quarterly edit changes a fact in **one** place and every render follows. They are not a duplicate of the body text awaiting cleanup.

Commit `dc8069e` deleted `current_role`, `skills_inventory`, `education`, and the change log while moving certifications out to `scripts/data/certifications.json`. **Only the certifications move was intended.** The other four deletions were accidental and were restored on 2026-10-05. Do not "clean up" these fields as redundant — the sections below are what reads them. Certifications have since left the repo altogether: Manager Tools puts none on a resume (see [Certifications](#certifications--on-no-resume) below).

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

`build-resume-variant.mjs` derives its entry ids **lazily**, on the first `validateConfig()` call that needs them, and memoizes the result. Importing the module therefore reads no file: a unit test can import it without the resume source on disk, and `validateConfig()` accepts an injected entry-id set so a test's expectations do not move when a heading in the live resume changes.

The remark plugin runs **first** in `astro.config.ts`'s `remarkPlugins`, before `remarkDirective`, and is inert on every other page.

### Adding a placeholder section

1. Add the name to `RESUME_SECTIONS` in `src/lib/resume-sections.mjs`.
2. Write its renderer, returning markdown. Throw on missing required data rather than returning a partial section.
3. Register it in `RENDERERS` and extend `renderResumeSection()`'s dispatch.
4. Add the field to the `pages` schema in `src/content.config.ts`.
5. Add tests to `tests/unit/resume-sections.test.mjs` (the renderer) and `tests/unit/remark-resume-sections.test.mjs` (the page path and the parity between the two).

A **single-line** placeholder-shaped comment whose name is not in `RESUME_SECTIONS` (`<!-- educaton -->`) **throws on both paths**, so a typo fails the build instead of rendering nothing. The page path scopes the whole plugin to `src/content/pages/resume/index.md` and returns before touching any other document, so both the guard and the expansion stay inside this one file — `<!-- more -->` *and* `<!-- education -->` are ordinary comments in a blog post.

Inside the resume, facet tags (`<!-- f: … -->`) and **multi-word** prose comments stay inert. A single lowercase kebab-case word is the placeholder shape, so `<!-- draft -->` in the resume throws as an unknown section; write `<!-- TODO revisit -->` or any multi-word form for a note that should survive.

**A placeholder is a top-level node.** The remark plugin walks `tree.children` only, so a comment nested inside a list item is not a placeholder on the page path even though the line-based `expandResumePlaceholders()` would expand it. Top-level is the contract; `tests/unit/remark-resume-sections.test.mjs` records it.

**A placeholder also occupies one line.** `classifyPlaceholder()` rejects an embedded line break before either regex runs, so a comment split across lines — `<!--`, `education`, `-->` — is an ordinary comment on both paths, the unknown-name form included: that one does *not* throw. The two paths do not receive the same unit. mdast hands the plugin that whole comment as a single HTML block, and both regexes spell their padding `\s*`, which matches a newline; `expandResumePlaceholders()` splits the body on newlines and sees three lines, none of them placeholder-shaped. Rejecting the line break is what keeps the two answers identical.

**A comment is one block, and nothing inside it counts as markdown.** `expandResumePlaceholders()` consumes a multiline HTML comment whole rather than reading the lines inside it, because CommonMark treats `<!-- … -->` as a single HTML block and nothing inside it can open anything else. Three backticks inside such a comment are comment text, not a fence. Reading them as a fence left the string path inside a code block that never closed, so every placeholder after that comment looked like sample text while remark — reading the comment as one block — expanded them: `education` absent from the PDF content expectations and its variant entry ids reported as unknown. The scanner checks for a comment opener *after* its indent test, since four columns of indentation make `<!--` indented code instead, and remark agrees.

**What the scanner still approximates.** It models fenced code, indented code and comment blocks, which is every container the resume convention uses. It does not model raw HTML block containers: a placeholder inside `<pre>`, `<div>`, `<script>` or `<table>` expands on the string path while the page path leaves it alone, because mdast folds the whole container into one HTML node. The resume source carries no raw HTML, so nothing reaches that gap today — but a body that grows one needs the selection logic shared rather than reimplemented. See the note at the end of this file.

## The admin line

Manager Tools puts every role's dates, title, and company on one line and sets them off, because a reader scans those first ([rubric](../references/manager-tools-rubric.md)). The page prints `Dates: Title, Company — Location`: the dates, title, and company in bold, the separators and the location plain. In print, the bold segments are Arial Bold at 10.5pt, the size at which sans matches the 11pt Times body, and the name prints in Arial Bold at its heading size [Kyle]. Nothing else on the resume carries bold, and nothing on it carries an underline: Manager Tools adds one, and Kyle overrides it.

The markdown keeps the two lines apart:

```markdown
## Senior Manager, IT

**Duke University, Office of Information Technology** — Durham, NC | July 2013 – June 2022
```

`src/lib/remark-resume-sections.mjs` joins them after it expands the placeholders:

1. It sets every heading's id first, through `headingIds()`: one github-slugger across every heading level, in document order. A job's id therefore comes from its title alone (`senior-manager-it`), and a date change never moves it. Astro keeps an id a heading already carries.
2. It then replaces each employer-line paragraph and the `##` heading above it with one `h2` built from `adminLineSegments()`. The dates, title, and company become `strong`, which `src/styles/resume.css` bolds.

The fold exists once. `renderedHeadings()`, exported from the same module, parses the expanded markdown with `fromMarkdown` and runs that fold over it, and `resume-render.mjs` checks the printed page for each heading it returns, so PDF verification covers every role's full admin line. The fold throws on an employer line that does not sit directly below a `##` heading (blank lines aside), so a misplaced line fails the build instead of printing a role with no dates.

The fold reads only bold text followed by plain text as an employer line. A paragraph that reads as one once its markup is flattened — a link or emphasis in the tail, a line break inside the bold — fails the build too. Left unfolded, it would print as a stray paragraph under a heading with no dates, and PDF verification, running the same fold, would agree with the page and pass.

Education has no admin line: each degree renders as a single heading (see `education` below).

## Field-by-field: what populates what

### `name` — the name line

| Output | Where |
|---|---|
| The h1 on `/resume/` and `/resume/print/` | `ResumeHeader.astro` |
| The first line of the PDF, .docx and .txt | the print route's h1, read by `extractResumeBlocks()` |
| The PDF's Title field | the print route's `<title>`, which Chromium copies |
| The .docx's title and author | `buildResumeDocx()`, from the name block |

`title` is a separate field: it feeds the `/resume/` page's `<title>` and its social-card titles ("Kyle Skrinak — Resume"), and no file. Both resume routes throw without `name`, and `resume-render.mjs` checks the rendered page for it.

### `current_role` — injected, four consumers

| Output | Where |
|---|---|
| The resume's lead admin line (its `##` heading and employer line) | `<!-- current-role -->` |
| The `/resume/` meta description | `resumeMetaDescription()` in `src/pages/resume.astro` |
| The `/resume/print/` meta description | the same function in `src/pages/resume/print/index.astro` |
| The About page's current-position sentence | `src/pages/about.astro` reads the resume entry via `getEntry("pages", "resume")` |
| The employer link in that sentence (`<a href>`) | `current_role.employer_url`, read by the same `about.astro` sentence |

Changing the job title in frontmatter changes all four. Before this wiring, `about.astro` carried its own hand-typed copy, and the two drifted.

`location`, `start_date`, and `employer_url` are all required, for two different reasons. The employer-line convention is `**Employer** — Location | Dates`, and a line missing either tail field stops being recognized as one, so it never joins its heading (see below). `employer_url` is required because the About page links the employer name: an optional field there would render a silently unlinked name rather than fail the build.

`start_date` is `YYYY-MM` or `YYYY-MM-DD`, and `formatMonthYear()` anchors the match at **both** ends. Trailing text throws instead of rendering the prefix: both renderers read raw frontmatter, so the schema's `z.coerce.date()` has never run by the time a value arrives, and `2022-060` or `2022-06-not-a-date` would otherwise print as June 2022 with nothing downstream to catch it — PDF verification compares the printed page against the same wrong month it rendered from. A `Date` is accepted too and read in UTC.

The optional day is validated against the month and the year, so `2022-06-31`, `2022-06-00` and `2023-02-29` all throw while `2024-02-29` passes. The day never reaches the rendered text, which is exactly why it is checked here: PDF verification cannot see a wrong day, and no other validator runs on this path.

**One recognizer, three consumers.** `src/lib/resume-sections.mjs` exports `isEmployerLine(line)` and `parseEmployerLine(line)` beside the function that *builds* the line, so the convention is written down once. The remark plugin's fold joins the line to its heading through `parseEmployerLine`, and `renderedHeadings()` runs that same fold to produce the PDF content expectations for `resume-render.mjs`; `lint-resume.mjs` skips the line through `isEmployerLine` when it collects scope prose. `parseEmployerLine` splits the tail on its first pipe, so dates may carry a pipe and a location may not. The producer also checks its own output against that recognizer before returning it: three non-empty fields are not sufficient, because the regex requires a **digit after the pipe**. A line the recognizer rejected would never join its heading, so the page would print it as a stray bold paragraph under a title with no dates, and PDF verification would stop checking that entry's company and dates. The shared regex deliberately has no `/g` flag — a global regex carries `lastIndex` between callers, so a `.test()` and a `matchAll()` on one object silently skip matches.

### `education` — injected

`<!-- education -->` renders one section per item whose `render` flag is `true`. Each item is a single heading in the Manager Tools sample's order — degree, school, dates — with the location beside the school:

```markdown
## M.S. I.T., Rochester Institute of Technology — Rochester, NY | 1998 – 2001
```

No employer line follows it, so nothing joins it: a degree has no title or company for an admin line to set off. The degree uses `degree_abbr` when present, falling back to the formal `degree` — so `M.S. I.T.` prints on the resume while the full degree name stays available in the data. `institution`, `location`, and `years` are required, and `years` must contain a digit, because an entry reading "Ongoing" states no date at all: `"2019"`, `"expected 2027"`, and `"1998 – 2001"` all pass; `"Ongoing"`, `"In progress"`, and `"Present"` all throw.

An item is opt-in: the renderer prints it only when `render: true` is written in the file. **The schema default does not supply that opt-out** — both renderers read raw frontmatter, before Zod runs, so an item carrying no `render` key at all is skipped by the renderer's own `=== true` check, not by `z.boolean().default(false)`. The schema default governs only the typed collection entry that `getEntry()` consumers see. Zero rendered items expands to nothing (an explicit opt-out). A **missing `education` object** throws, because the placeholder then points at data that does not exist.

`items` carries **no default**, for the same raw-frontmatter reason. The schema makes the key required, so only the Node callers that parse the YAML directly can reach a missing or null `items` — and a default of `[]` would read that absence as the authored empty array above. PDF generation would then expect no education heading, and pass. A missing or non-array `items` throws; an authored `items: []` still expands to nothing, because that one is a choice.

Every item is validated **before** the opt-in filter runs, and that ordering is the point. The filter asks only whether `render` is literally `true`, so it cannot tell a malformed item from a deliberate opt-out: `items: [null]`, a bare string, and `render: "true"`, `1` or `null` would all read as "skip" and quietly drop the section from the PDF content expectations, leaving `resume-render.mjs` verifying a page that never carried it. A non-mapping item and a non-boolean `render` both throw. An omitted flag and a literal `false` remain opt-outs — `z.boolean().default(false)` defaults `undefined` only, never `null`, so rejecting `render: null` is what matches the schema.

The opt-in default is deliberate, and it is why the field is a boolean rather than an implicit "render everything present." Kyle pursues ongoing coursework, and whether a given item *belongs* on the resume is a judgment call raised during a revision — not a settled property of the data. `render: false` records an item without printing it, so the metadata stays complete while the rendered resume stays selective.

Each education heading gets its id from the same `headingIds()` pass as the job headings, so the id slugs the whole line (`ms-it-rochester-institute-of-technology--rochester-ny--1998--2001`). Education carries no bullets, so no variant config needs one.

### `skills_inventory` — a record, rendered nowhere

The nine categories render nowhere, a tailored variant included: Manager Tools puts no skills list on a resume and names a required technology inside an accomplishment instead. The inventory stays in the frontmatter as a record, and the quarterly review still checks it.

`last_reviewed` is the quarterly-review marker, maintained by hand.

### `description` — the career summary only

`resumeMetaDescription()` composes the meta description as `current_role.title` + `". "` + `description`. The role sentence therefore must **not** be repeated in `description`; that field carries only the career summary no structured field can derive.

### `changelog` — a record, not a render

Nothing renders it. It documents what changed and why, which is how the `dc8069e` accident above is now traceable from the source file itself.

### Certifications — on no resume

Manager Tools puts no certifications on a resume, tailored variants included; a certification a posting requires goes in the cover letter, which stays outside this repo. **Keep certification information out of the resume source.** `scripts/data/certifications.json` and the variant builder's certification section are gone.

`src/content.config.ts` carries **no `certifications` block**, and that absence is deliberate: the resume frontmatter has no such key, so a schema block would validate nothing.

## Two vocabularies, deliberately separate

| Vocabulary | Where defined | Count | Purpose |
|---|---|---|---|
| `FACETS` | `src/lib/remark-facets.mjs` | 7 | Tags body bullets and scope paragraphs (`<!-- f: leadership, cost -->`) so variants can filter them. |
| `skills_inventory.categories[].id` | the resume frontmatter | 9 | Names a block of the skills inventory, which renders nowhere. |

These overlap in wording (`leadership`, `platform-ops`) and **are not the same list**. A facet answers "does this bullet belong in this variant?"; a category id only labels part of the inventory. Do not reconcile them, and do not validate one against the other.

## Quarterly review

A revision is warranted by a role or title change, a completed project worth citing, or the quarterly staleness check. That last one is automated: `.github/workflows/resume-review-reminder.yml` opens an issue at each quarter start, and the issue is the trigger — a session should not also flag staleness on its own. Its checkboxes map to this file:

| Checkbox | What to edit |
|---|---|
| Update achievements and metrics | body bullets, with `<!-- f: … -->` tags |
| Review skills inventory and last-reviewed date | `skills_inventory` |
| Verify the change log entry | `changelog` |
| Confirm web and print renders match | `npm run build`, then review `/resume/` and the PDF; check the .docx and .txt in an applicant tracking system's upload preview |

## Verifying a change

```bash
npm run build        # runs lint-resume.mjs, then astro build
npm run test:unit    # resume-sections and resume-variant suites
node scripts/print-resume-pdf.mjs --output <path.pdf>   # one line per bullet and admin line, one page; writes .pdf, .docx, .txt
```

The render writes no file of any format when a bullet or admin line runs past one printed line, the page runs past one, or the .docx or .txt fails to read back to the printed page's content. It also refuses when the contact separator the print stylesheet prints differs from `CONTACT_SEPARATOR` in `scripts/lib/resume-formats.mjs`, which the .docx and .txt print. `--formats pdf` (or any comma-separated subset of `pdf,docx,txt`) limits what it writes; the PDF renders regardless, because the one-page check runs on it. Tighten or cut the lines it names; never shrink the type, since no print text goes below 11pt except the admin line's 10.5pt Arial Bold [Kyle].

A frontmatter change that should not alter the rendered text can be proved byte-for-byte by diffing `readResumeSource().expandedBody` against the committed body.

## Known gap: the two paths select placeholders with different machinery

The page path asks remark for the parse tree and walks `tree.children`. The Node path scans lines and models the three containers that can hide a placeholder: fenced code, indented code and HTML comment blocks. Three review rounds have now found a case where that model and CommonMark disagreed — a tab inside the first four columns, a comment split across lines, and a fence written inside a comment — and each was closed in `src/lib/resume-sections.mjs` with a test in `tests/unit/remark-resume-sections.test.mjs`.

One gap is left open deliberately: a placeholder inside a raw HTML container (`<pre>`, `<div>`, `<script>`, `<table>`) expands on the string path and not on the page path. Closing it by hand would be a fourth approximation of the same parser. The root-cause fix is to select placeholders from one parse — have `expandResumePlaceholders()` parse the body with `fromMarkdown`, take the top-level HTML nodes, and splice the string by their `position.offset` ranges — so the two paths cannot disagree by construction and line-based replacement still keeps the surrounding offsets intact.

The fix adds no package: `mdast-util-from-markdown` is already a runtime dependency, because `src/lib/remark-resume-sections.mjs` imports it in the production Astro build. The resume source carries no raw HTML, so nothing reaches the gap today. Revisit when that changes.
