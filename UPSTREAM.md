# Upstream: AstroPaper

The site's theme is [AstroPaper](https://github.com/satnaing/astro-paper) by [Sat Naing](https://satnaing.dev) and [contributors](https://github.com/satnaing/astro-paper/graphs/contributors), under the MIT license in `LICENSE`. The site tracks upstream `main` with git merges, following upstream's own guide ("Updating AstroPaper using Git"). Issue #443 made the first merge. `git merge-base HEAD astro-paper/main` names the last upstream commit merged.

## Remote setup

```sh
git remote add astro-paper https://github.com/satnaing/astro-paper.git
git config remote.astro-paper.tagOpt --no-tags
git fetch astro-paper
```

The tag setting keeps upstream's tags out of the repo, so `git push --tags` can't publish them.

## Update procedure

On GitHub, Watch → Custom → Releases on `satnaing/astro-paper` announces each release.

1. `git fetch astro-paper`
2. `git log --oneline HEAD..astro-paper/main` lists the commits not yet merged. Read them with upstream's release notes.
3. From an up-to-date `develop`: `git checkout -b build/update-astro-paper`
4. `git pull --no-rebase --no-commit astro-paper main`
   - Resolve conflicts by the rules below.
   - Review every added path: `git diff --cached --name-status --diff-filter=A HEAD`. Remove each path rule 5 excludes.
   - A modify/delete conflict on a file the site dropped resolves to deleted.
   - If git answers "refusing to merge unrelated histories", a squash merge broke the link to upstream. Stop. Don't add `--allow-unrelated-histories`.
5. Set `themeMergedVersion` in `src/pages/stack.astro` to the `version` in upstream's `package.json` at the merged commit: `git show astro-paper/main:package.json`. The stack page shows it next to the fork base, 5.5.1.
6. Run the quality gates in `CLAUDE.md`, then the drift check below.
7. Merge the PR, and the promotion PR after it, with **Create a merge commit**. A squash or rebase merge drops upstream's commits from the site's history and breaks the next update.

### Conflict rules

1. **Upstream's method wins.** Where the site does the same job differently, the site's version goes. When a resolution undoes a site change, name it in the PR with upstream's stated reason and the site's commit.
2. **Site-only features stay, as marked overrides.** In an upstream file, a site feature goes in as a site-owned component added with one line; only attributes, such as microformat classes, go inline. Each override carries a `SITE-OVERRIDE: <what>` comment on the line above it and a row in the table below. Files without comment syntax get the row only.
3. **Values are the site's:** config values, title, socials, share networks, UI wording in `en.ts`, the home hero and the OG card designs.
4. **Repo tooling stays the site's:** npm (not pnpm), `package.json` identity, the README. `LICENSE` keeps upstream's MIT notice.
5. **Upstream's form and function land; its content never does:** demo posts and their images, `default-og.jpg`, the demo `about.md`, brand assets (`favicon.svg`, `astropaper-og.jpg`), pnpm files, `.github/`, `.vscode/`, `compose.yaml`, `cz.yaml`, `CHANGELOG.md` and the Lighthouse SVG.

## Drift check

```sh
git diff --name-status astro-paper/main HEAD
git grep -n SITE-OVERRIDE -- . ':!*.md'
```

- Each `M` path has a row below.
- Each `D` path is a rule 5 exclusion.
- `A` paths are site-only files and need no row: the resume, presentations, stack, lchf, archive-book and categories pages, the Jekyll `[year]` stubs, `sitemap.xml.ts`, `site.webmanifest`, `test-data.json`, and the components, scripts and tests behind them.
- Every `SITE-OVERRIDE` marker has a row below.

## Rollback

A reverted merge stays recorded as merged, so if an update's merge is ever reverted, the next update starts by reverting that revert.

## Departures

| File | What | Why |
|---|---|---|
| `astro-paper.config.ts` | The site's values; `site.url` reads `SITE_URL`, falling back to production | Rule 3. `config/validate.mjs` checks the fallback against `config/registry.mjs` |
| `astro.config.ts` | No `@astrojs/sitemap`; the site serves `/sitemap.xml` | Kyle, 2026-11-03: `@astrojs/sitemap` can only write `sitemap-index.xml` plus numbered files |
| `astro.config.ts` | `trailingSlash: "always"` and an explicit `base: "/"` | S3 and CloudFront directory URLs and canonicals; `config/validate.mjs` reads `base` |
| `astro.config.ts` | Markdown plugins: remarkResumeSections, remarkDirective with remarkCards, remarkFacets, rehypeImageOptimization | Resume sections, `:::cards` and facets are site-only content features |
| `astro.config.ts` | IBM Plex Mono, from local files, in the Fonts API list | The OG card designs; Google's copy lacks U+2011, which the home card sets |
| `astro.config.ts` | Sharp `limitInputPixels`, constrained responsive images, the site env schema, `DISABLE_DEV_TOOLBAR` | Site build and deploy settings |
| `eslint.config.js` | `no-console` allowances; ignores `infra/cloudfront/.rollback/` | Site scripts write to the console; the rollback snapshots are gitignored |
| `tsconfig.json` | `"types": ["node"]` | `Buffer` in the OG routes and `node:` modules in site code; TypeScript 6 no longer loads `@types/*` on its own |
| `package.json` | npm, the site's `name`, `version`, scripts and dependencies; no `@astrojs/sitemap` | Rule 4; the sitemap row above |
| `README.md`, `.gitignore`, `CHANGELOG.md`, `Dockerfile`, `.dockerignore`, `.vscode/extensions.json` | The site's own files | Rules 4 and 5 |
| `src/content.config.ts` | Site-only post fields (hero image, alt, caption, crop position, categories, source, toc), hero format rules and required alt text, the resume's `pages` fields | Site-only features |
| `src/i18n/lang/en.ts` | "Revised on" | Rule 3 |
| `src/utils/getSortedPosts.ts` | Sorts by `pubDatetime`, not `modDatetime ?? pubDatetime` | Kyle, 2026-11-03: a revision never moves a post |
| `src/pages/rss.xml.ts` | Item date is `pubDatetime` | Kyle, 2026-11-03: a revision never re-dates a feed item |
| `src/components/Datetime.astro` | A revised post shows "<publish date> · Revised on: <revision date>", via `PublishedDate`; `flex-wrap`; `dt-published` or `dt-updated` | Kyle, 2026-11-03; microformats |
| `src/utils/getPostPaths.ts` | Drops the repeated directory of a co-located `foo/index.md` | Keeps `/posts/foo/`, not `/posts/foo/foo/` |
| `src/utils/slugify.ts` | "+" reads as "plus" (5ec6019) | Keeps the "Code+" tag at `/tags/code-plus/` |
| `src/pages/robots.txt.ts` | `robots.txt` names `/sitemap.xml` | The sitemap row above |
| `src/layouts/Layout.astro` | `<SiteHead />` (favicons, manifest, `rel="me"`, noindex), the Cloudflare beacon, trailing-slash canonicals, `rel="sitemap"` to `/sitemap.xml`, no `favicon.svg` link | Site-only features; rule 5 for the favicon |
| `src/layouts/PostLayout.astro` | Escapes `<` in the JSON-LD | A title containing `</script>` can't end the block |
| `src/components/Header.astro` | About dropdown and Presentations link (`HeaderSiteNav`); the skip link moves with a transform, not `top` (cdaf43c) | Site-only pages; Lighthouse non-composited animation |
| `src/components/Breadcrumb.astro` | Underlined links (4fc1c51) | Lighthouse accessibility: links must not rely on color alone |
| `src/components/Footer.astro` | The h-card; the "Social Links:" label (70a5e40) | Microformats; the site's wording |
| `src/components/Socials.astro` | `rel="me"` on every link | Profile verification |
| `src/components/Tag.astro` | `p-category` | Microformats |
| `src/pages/index.astro` | The site's hero text | Rule 5: upstream's is demo text |
| `src/pages/404.astro` | noindex,follow (871ac25); canonical points home (163b3ee) | SEO |
| `src/pages/posts/[...page].astro`, `src/pages/tags/index.astro`, `src/pages/tags/[tag]/[...page].astro`, `src/pages/search.astro` | noindex,follow (871ac25); the search hint names npm | SEO; rule 4 |
| `src/pages/posts/[...slug]/index.astro` | Hero image, a hero ahead of the dynamic OG card, h-entry classes and identity, reading time, reply by email, the heading anchors' `aria-label` (455c6e4) | Site-only features; the anchor's only child is `aria-hidden` |
| `src/pages/posts/[...slug]/_components/ShareLinks.astro` | `<NativeShare />`, the native Web Share button (f452f5b, #64), ahead of the network links; the page URL is percent-encoded (70a5e40) | Kyle, 2026-11-03; the URL's own query string and fragment stay inside the share parameter |
| `src/pages/og.png.ts`, `src/pages/posts/[...slug]/index.png.ts` | The site's card designs (`src/utils/og-templates/`), set in IBM Plex Mono | Rule 3 |
| `src/styles/global.css` | `.card-row` styles | The `:::cards` directive |
