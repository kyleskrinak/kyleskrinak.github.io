# Image Asset Migration — Post-Mortem

**Status: Completed 2026-05-25.** All seven phases shipped on `develop` as commits `af1ec80` (Phases 1–7 consolidated) and the pre-PR review follow-up. This doc is kept as a record of the migration's rationale and gotchas for future reference.

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Spike one post (proof of concept) | ✓ Done |
| 2 | Update shared infrastructure (schema, components, utilities) | ✓ Done |
| 3 | Migration script + batch-migrate remaining 40 posts | ✓ Done |
| 4 | Empty `public/assets/`, clean orphans | ✓ Done |
| 5 | `new-post` scaffold script | ✓ Done |
| 6 | Rewrite `docs/getting-started/images.md` | ✓ Done |
| 7 | Husky pre-commit guard | ✓ Done |

## Context (why)

The blog had two parallel image stores: `src/assets/images/` (67 files, Sharp-processed via Astro) and `public/assets/images/` (58 files, served raw — a Jekyll-era holdover). Frontmatter referenced the first; seven posts used raw HTML `<img src="/assets/...">` blocks that pointed at the second and bypassed Sharp entirely. The 27 image-bearing posts all shared one flat `src/assets/images/` directory.

Three goals:
1. **One pipeline.** Every post image flows through Astro's Sharp processing — no raw-served images, no two-tier ambiguity.
2. **Co-location.** Each image-bearing post is a directory containing its `index.{md,mdx}` and its images. Astro 5's glob loader supports this directly.
3. **Guardrails.** New posts can't accidentally regress to the legacy patterns (Phase 7).

## Final structure (achieved)

```
src/content/blog/
├── 2026-05-20-image-heavy-post/
│   ├── index.md                 (or index.mdx for HTML <img> cases)
│   ├── hero.webp
│   ├── inline-1.webp
│   └── gallery/                 (optional sub-dir convention)
│       └── photo-1.webp
└── 2025-12-01-text-only-post/
    └── index.md                 (image-free posts also moved to dirs for uniformity)
```

Frontmatter references images as `./hero.webp`. Body too. The content collection schema uses Astro's `image()` Zod helper so paths resolve to `ImageMetadata` automatically.

`src/content/pages/lchf/` follows the same pattern. Pages collection schema also uses `image()` and a recursive glob.

`public/assets/` no longer exists. Presentation assets that used to live there moved to `public/presentations/assets/`.

## Code changes (what's in the patches)

**Schema & rendering:**
- `src/content.config.ts` — both `blog` and `pages` collections use the `({ image })` schema callback with `image()` helper; pages glob now `**/*.{md,mdx}`.
- `src/layouts/PostDetails.astro` — passes `image` directly to `<Image>` (was `getOptimizedImage(image)`).
- `src/components/Figure.astro` — prop renamed `image_path` → `src` during Phase 2. Deleted after the pre-PR review found it had no callers post-migration; the rewritten `.mdx` posts use `<Image>` directly with inline `<figure>` markup.
- `src/utils/getPath.ts` — drops trailing pathSegment when it equals slug (fixes `/posts/foo/foo/` duplication for `index.md` entries).

**Markdown pipeline:**
- `astro.config.ts` — added `@astrojs/mdx` integration. MDX posts can `import` ImageMetadata.
- `src/lib/rehype-components.ts` — removed dead `rehypeComponents` function.
- `src/lib/image-loader.ts` — deleted (was unused).
- `src/lib/images.ts` — deleted (no consumers after migration).

**Tooling:**
- `scripts/migrate-post-to-directory.mjs` — batch migration tool. Per-slug or `--all`. Supports `--dry-run`. Strips `<style>` blocks when emitting MDX. Sanitises filenames (e.g. `in memorandum.svg` → `in-memorandum.svg`). Sweeps originals after migration.

**Content:**
- All 41 blog posts migrated to `src/content/blog/<slug>/index.{md,mdx}`.
- 7 posts converted to `.mdx` because they contained raw HTML `<img>` blocks (rewritten to `<Image>` with imported `ImageMetadata`, surrounding `<figure>` / `<figcaption>` preserved including float layouts).
- `src/content/pages/lchf.md` → `src/content/pages/lchf/index.md` with 3 co-located images.
- `public/assets/` deleted entirely (130 files).
- `public/presentations/assets/` created with 14 files moved from `public/assets/`; 4 presentation HTML files and 1 test assertion updated to reference the new path.
- `src/assets/images/{code-plus,favicon,gitlab-ci.mp4}` deleted (Jekyll/Drupal-era cruft).
- 6 `src/content/blog/*.md.tmp` Jekyll export artifacts deleted.

## Decisions log (gotchas learned during execution)

These shaped the patches; capture them so future debugging doesn't waste time re-discovering.

- **Astro glob loader id convention.** For `foo/index.md`, the entry id is `foo` (the parent directory name), not `foo/index`. The original `getPath` assumed flat-file layout and produced `/posts/foo/foo/` duplication. Fix: drop the last pathSegment when it equals the slug.
- **MDX integration is required** once any post uses raw HTML `<img>` blocks, because they're rewritten to `<Image>` with an imported `ImageMetadata`. Markdown alone can't do `import` statements.
- **MDX is strict about CSS-in-`<style>`.** CSS `{ }` braces parse as JSX expressions and blow up the build. The migration script strips `<style>` blocks when emitting `.mdx`. Six posts (including `2018-10-20-my-morning-routine`) had Jekyll-era inline styles — now gone.
- **Same image referenced twice (frontmatter + body) produces duplicate imports.** Dedupe in `buildImportBlock` by `importName`.
- **Filename sanitisation matters.** `in memorandum.svg` (with a space) became `in-memorandum.svg` so JS imports work and URLs don't need encoding.
- **Shared images need copy-not-move.** `drupal_logo.png` is referenced by 8 posts. The migration script copies images into post dirs (not rename), then sweeps the originals once all migrations succeed. Tracked via an explicit `migratedSources` Set rather than basename-grep (which incorrectly matched co-located references).
- **Presentations are real users of `public/assets/`.** Four presentation HTML files in `public/presentations/` referenced 14 images under `/assets/images/`. They're static HTML, not blog content. The Phase 4 solution: move them to `public/presentations/assets/` (co-located with the HTML that uses them) and update the four HTMLs + one Playwright assertion. This stayed inside the "no raw `/assets/` URLs" rule while leaving the presentation toolchain alone.
- **lchf page image rendered as metadata-only.** The `lchf.astro` layout never reads `image` from frontmatter — only `title` and `description`. Field kept anyway for schema consistency.

## Phase deliverables (reference)

### Phase 5 — `new-post` scaffold script

`scripts/new-post.mjs <slug> [--images <source-dir>]`:

1. Create `src/content/blog/<slug>/index.md` with a frontmatter stub (title, today's `pubDate`, empty `tags`, `published: false`).
2. With `--images <dir>`: copy each image into the post dir, convert to WebP at quality 85 with max width 1200px (use the existing `sharp` dependency — no new deps). Emit a frontmatter `image:` line referencing the first image and inline `![alt](./<basename>)` for the rest as a starting block in the body.
3. Wire as `npm run new-post -- <slug>` in `package.json`.

Why: removes the manual cargo-cult workflow currently in `docs/getting-started/images.md` (which itself gets rewritten in Phase 6). The script becomes the supported entry point.

Edge cases to handle:
- Slug already exists → error, don't overwrite.
- `--images` dir doesn't exist → error.
- Images that are already WebP / SVG → copy as-is, skip Sharp conversion.

### Phase 6 — Rewrite `docs/getting-started/images.md`

The existing doc is built around the two-tier `src/assets/images/` + `public/assets/` model. Both are gone. Rewrite to lead with:

- Per-post co-located pattern (frontmatter `./foo.webp`, body `![](./foo.webp)`, gallery sub-dirs).
- The `image()` schema helper.
- `npm run new-post` workflow (Phase 5).

Touch sibling docs:
- `docs/getting-started/file-structure.md` — update tree diagram (no more `src/assets/images/`, no more `public/assets/`).
- `docs/getting-started/creating-posts.md` — cross-reference the new image flow.

### Phase 7 — Husky pre-commit guard ✓ Done

Implemented as:

- `husky@^9.1.7` installed (lint-staged dropped — single-script use case didn't need per-file routing).
- `npx husky init` set `core.hooksPath` to `.husky/_` and added `"prepare": "husky"` to package.json (auto-installs hooks on clone).
- `.husky/pre-commit` runs `node scripts/check-image-conventions.mjs` (staged-file mode).
- `.husky/pre-push` runs `./docker-build-test.sh`, migrating the previously hand-rolled `.git/hooks/pre-push`. Old `.git/hooks/pre-push` deleted to avoid a stale second source of truth.
- `package.json` `build:ci` now runs `node scripts/check-image-conventions.mjs --all && astro build && pagefind`. New `check:images` script for manual runs.
- `scripts/check-image-conventions.mjs` enforces:
  - **Block**: new files under `public/assets/` (any extension).
  - **Block**: post markdown (`src/content/**/*.{md,mdx}`) matching `src="/assets/..."` or `](../../assets/images/...`.
  - **Warn**: post-co-located images > 500 KB.
  - **Warn**: JPG/PNG inside a post directory unless suffixed `.original.{jpg,png}`.
- Reports file:line for block diagnostics. Exits non-zero on blocks; warns print without failing. Bypass: `git commit --no-verify`.

Documented in `docs/getting-started/images.md` under "Guardrails."

## Verification (whole roadmap)

Per phase:
- `npm run build` clean.
- `npm run check:links` zero broken.
- `npm run test:visual` passes.

After all phases:
- `find public/assets -type f` returns nothing. (✓ done)
- `grep -r '/assets/' src/content/` returns nothing for image paths. (✓ done)
- `dist/_astro/` contains WebP variants of all post images. (✓ verified)
- Production deploy succeeds; spot-check a migrated post on `kyle.skrinak.com` after push.

## Out of scope

- External image CDNs (Cloudinary, ImageKit) — declined.
- S3 media bucket — declined; co-located is the answer.
- Lightbox / image-search UI.
- Replacing satori for OG generation.
- Video / animated GIF handling beyond what works today.
- CloudFront redirect rules for legacy `/assets/*` URLs — open decision after deploy.

## Files in this plan

For a future Claude session resuming this work, the immediate files to read are:

- `src/content.config.ts` — schema definitions (both collections use `image()`).
- `scripts/migrate-post-to-directory.mjs` — reference for the migration patterns; Phase 5 `new-post.mjs` should share the WebP conversion approach.
- (`src/components/Figure.astro` was deleted in the pre-PR review cleanup — see commit history.)
- `src/layouts/PostDetails.astro` — how `image` flows from schema to render.

Patches (preserved in repo or downloads):
- `imagemigrationfull.patch` (Phases 1+2+3)
- `phase4additions.patch` + `phase4deletes.sh` (Phase 4 delta)
