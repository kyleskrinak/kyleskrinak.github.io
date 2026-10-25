# Resume Variants

Resume variants are local, disposable resumes (PDF, .docx and .txt) built from the published resume page with small DOM transforms. The public `/resume/` page and the canonical generated resume PDF remain unchanged unless you edit the resume source itself.

Use this workflow when you need a tailored one-page resume for a specific job role without changing the published default.

A variant follows every rule in the [Manager Tools rubric](../references/manager-tools-rubric.md) and varies only which accomplishments appear. It adds nothing: no headline, no skills section, no certifications. Headings, which carry each role's admin line, and scope paragraphs always stay.

## How do I restructure my resume for a specific job role?

Start by reading the job description and identifying the strongest fit themes. Map those themes to resume facets:

| Theme | Facet |
|---|---|
| Team leadership, management, mentoring | `leadership` |
| Operations, reliability, incident response | `platform-ops` |
| Security reviews, compliance, risk | `security` |
| Web development, CMS, Drupal, WordPress | `web-dev` |
| Creative, design, pre-press, agency work | `creative` |
| Cost reduction, FinOps, right-sizing | `cost` |
| Delivery, launches, project execution | `delivery` |

Then restructure the resume with this workflow:

1. Create a variant JSON file outside the repo, usually in your private resume variants folder.
2. Set `include_facets` to emphasize the role's themes. Add `exclude_facets` only when a theme is clearly distracting.
3. Use `bullet_order` to rank accomplishments by relevance to the role: one list for the whole page, most relevant first. Manager Tools sets no bullet count, so choose across the whole page rather than capping each entry.
4. Build the variant, review the PDF visually, and adjust the config until the one-page result reads correctly. If the page has room, keep another relevant accomplishment.

## Variant config example

```json
{
  "include_facets": ["platform-ops", "leadership", "cost"],
  "bullet_order": [
    "senior-it-systems-engineering-manager-digital-experience/2",
    "senior-manager-it/0",
    "senior-it-systems-engineering-manager-digital-experience/0"
  ]
}
```

Supported fields:

| Field | Purpose |
|---|---|
| `include_facets` | Keep tagged bullets that match at least one listed facet. Untagged bullets always render. |
| `exclude_facets` | Remove tagged bullets that match any listed facet. Exclude wins over include. |
| `bullet_order` | The bullets to keep across the whole page, as `"<entry id>/<n>"` items, most relevant first. |

Any other key fails validation. That includes the retired `title`, `max_bullets_per_entry`, `include_certs`, `anchor_before_id`, `include_skills`, and `skills_anchor_before_id`, so a stale config fails loudly instead of building a resume the rubric rules out.

## Choosing bullets with `bullet_order`

- `bullet_order` is one ranked list for the whole page. Each item names one bullet as `"<entry id>/<n>"`, so `"senior-manager-it/0"` is that role's first bullet.
- The entry id is the `id` of a rendered resume `h2`. The builder derives the valid set from the expanded resume source through `headingIds()` in `src/lib/resume-sections.mjs`, the function that also sets the page's ids, so a renamed role cannot leave a stale item behind.
- A job's id comes from its title alone (`senior-manager-it`). The dates and company fold into the heading after the id is set, so a config survives a date change. Renaming a title changes its id.
- `n` counts the entry's bullets as written in the resume source, starting at 0, before any facet filter. An index past the end, a duplicate item, or an item naming a bullet the facets exclude fails the build.
- Each bullet stays under its own entry; the list's order sets the order within each entry. Entries keep their resume order.
- An unlisted bullet drops. An entry the list never names keeps its heading and scope, loses every bullet, and prints a warning in the terminal.
- Without `bullet_order`, every bullet the facets pass renders, in source order.

## Build a variant

```bash
npm run resume:variant -- --variant platform-ops
```

Config resolution order:

1. Literal path, absolute or containing a path separator.
2. `$RESUME_VARIANTS_DIR/<name>.json`.
3. `~/Claude/Projects/KDS Resume/variants/<name>.json`.

One render writes all three formats, so they carry the same content. By default the builder writes `<variant>.pdf`, `<variant>.docx` and `<variant>.txt` next to the variant config. Pass `--output` to name the PDF somewhere else; the other two go beside it under the same base name. `--output` must end in `.pdf`:

```bash
npm run resume:variant -- --variant ~/resume-variants/platform-ops.json --output /tmp/platform-ops.pdf
```

Pass `--formats` to write a subset, as a comma-separated list of `pdf`, `docx` and `txt`:

```bash
npm run resume:variant -- --variant platform-ops --formats pdf,docx
```

The PDF renders even when `--formats` leaves it out, because the one-page check runs on it.

Use `--base-url` only when the remote page matches the local resume source. The variant builder validates entry ids against the local markdown, then transforms the loaded page DOM, so stale remote content can carry different entries or bullets than the config names.

## Validation and failure behavior

The builder writes no file of any format when:

- The variant config has unknown keys or malformed values.
- A facet id or entry id is unknown.
- A `bullet_order` item is malformed, listed twice, past the end of its entry, or names a bullet the facets exclude.
- The rendered page is missing the title, the contact details, or any heading's full text. Each role's heading carries its whole admin line.
- Any bullet runs past one printed line.
- The rendered resume is not exactly one page.
- The .docx or .txt does not read back to the printed page's text, bold, underline, links and bullets.

If a bullet wraps, tighten it in the resume source or drop it from the variant. If the one-page gate fails, drop the last items from `bullet_order` or narrow the facets. Never shrink the type: no print text goes below 11pt.

## Operational notes

- Variants are local, one-off artifacts; visually inspect the generated PDF before sending. Before uploading the .docx or .txt to an applicant tracking system, check how the site renders the upload.
- The published resume body remains the source of truth for default output.
- The variant builder does not run `astro build`; run `npm run build` first unless using `--base-url`.
- The default preview port is `4323`, shared by `build-resume-variant.mjs` and `print-resume-pdf.mjs` — one variable, one port. Override both with `RESUME_PREVIEW_PORT` if another process is using it. Neither defaults to `4321`; that is the dev server's port, and a preview started there cannot bind, so the render would silently take the dev server's output instead of `dist/`.
- Variant files should stay outside the repository unless intentionally captured.
