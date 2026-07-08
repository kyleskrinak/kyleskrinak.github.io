# Resume Variants

Resume variants are local, disposable PDFs built from the published resume page with small DOM transforms. The public `/resume/` page and the canonical generated resume PDF remain unchanged unless you edit the resume source itself.

Use this workflow when you need a tailored one-page resume for a specific job role without changing the published default.

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
3. Use `max_bullets_per_entry` to keep the PDF to one page. Trim weakest job bullets first.
4. Use `bullet_order` only when the best bullet for a role is not already first after filtering.
5. Add `include_certs` when certifications strengthen the role match.
6. Build the variant, review the PDF visually, and adjust the config until the one-page result reads correctly.

## Variant config example

```json
{
  "title": "Kyle Skrinak - Platform Operations Leader",
  "include_facets": ["platform-ops", "leadership", "cost"],
  "max_bullets_per_entry": 3,
  "include_certs": ["az-104", "aiops-foundation"]
}
```

Supported fields:

| Field | Purpose |
|---|---|
| `title` | Optional resume title override. |
| `include_facets` | Keep tagged bullets that match at least one listed facet. Untagged bullets always render. |
| `exclude_facets` | Remove tagged bullets that match any listed facet. Exclude wins over include. |
| `max_bullets_per_entry` | Cap kept bullets per resume entry. |
| `bullet_order` | Reorder kept bullets by post-filter index for a specific entry id. |
| `include_certs` | Add certifications by id, or use `"all"` for file order. Omitted or `[]` means no cert section. |
| `anchor_before_id` | Optional per-variant cert placement override. Must match a rendered resume `h2` id. |

## Certification data

Certification metadata lives in `scripts/data/certifications.json`:

```json
{
  "anchor_before_id": "ms-it",
  "certifications": [
    {
      "id": "aiops-foundation",
      "name": "AIOps Foundation",
      "issuer": "PeopleCert",
      "issued": "2026-01"
    },
    {
      "id": "az-104",
      "name": "Microsoft Certified: Azure Administrator Associate (AZ-104)",
      "issuer": "Microsoft"
    }
  ]
}
```

Rules:

- `id` and `name` are required and must be non-empty.
- `issuer` is optional but must be non-empty when present.
- `issued` is optional and must use `YYYY-MM`.
- Duplicate certification ids fail validation.
- `anchor_before_id` sets the default insertion point for the Certifications section.
- A variant config can override placement with its own `anchor_before_id`.
- `facets` on certification entries is not supported yet and fails validation.

## Build a variant

```bash
npm run resume:variant -- --variant platform-ops
```

Config resolution order:

1. Literal path, absolute or containing a path separator.
2. `$RESUME_VARIANTS_DIR/<name>.json`.
3. `~/Claude/Projects/KDS Resume/variants/<name>.json`.

By default, the PDF is written next to the variant config. Pass `--output` to choose another path:

```bash
npm run resume:variant -- --variant ~/resume-variants/platform-ops.json --output /tmp/platform-ops.pdf
```

Use `--base-url` only when the remote page matches the local resume source. The variant builder validates entry ids against the local markdown, then transforms the loaded page DOM; stale remote content can fail anchor lookup.

## Validation and failure behavior

The builder fails before writing a PDF when:

- The variant config has unknown keys or malformed values.
- A facet id, cert id, entry id, or cert anchor is unknown.
- `certifications.json` is missing or malformed when certs are requested.
- The cert section cannot be injected at the requested anchor.
- A requested certification name is missing from the rendered cert list.
- The rendered resume is not exactly one page.

If the one-page gate fails, reduce job bullets first with `max_bullets_per_entry`, `include_facets`, or `exclude_facets`. If certs caused the overflow, reduce `include_certs`.

## Operational notes

- Variants are local, one-off artifacts; visually inspect the generated PDF before sending.
- The published resume body remains the source of truth for default output.
- The variant builder does not run `astro build`; run `npm run build` first unless using `--base-url`.
- The default preview port is `4323`. Override with `RESUME_PREVIEW_PORT` if another process is using it.
- Variant PDFs should stay outside the repository unless intentionally captured.
