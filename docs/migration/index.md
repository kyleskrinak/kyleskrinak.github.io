# Migration History

This section documents the Jekyll → Astro migration journey. Useful for understanding design decisions.

## Migration Overview

- **[Migration Status](./status.md)** - Complete status report of the migration project
- **[URL Mapping](./url-mapping.md)** - How old Jekyll URLs map to new Astro URLs
- **[Performance Comparison](./jekyll-astro-comparison.md)** - Lighthouse scores: Jekyll vs Astro

## Presentations Handling

Presentations were a special case in the migration. Two documents explain the journey:

- **[Presentations Deployment](./presentations-deployment.md)** - Architecture decisions and final solution
- **[Presentations Fix Details](./presentations-fix.md)** - Implementation details and lessons learned

## Key Takeaways

1. **36 blog posts** successfully migrated
2. **8 presentations** converted to Slidev
3. **Average performance improvement**: +42.8 points (Lighthouse)
4. **Build time**: ~2 seconds
5. **URL redirects**: 301 redirects from Jekyll URLs implemented

## Migration Phases

| Phase | Status | Details |
|-------|--------|---------|
| Foundation Setup | ✓ Complete | Astro scaffold, structure, dependencies |
| Content Migration | ✓ Complete | 36 posts, 9 pages, 8 presentations |
| Feature Development | ✓ Complete | Search, RSS, sitemap, analytics, etc. |
| Testing | ✓ Complete | Visual regression, Lighthouse audits |
| Infrastructure | ✓ Complete | GitHub Pages staging, AWS production |
| Launch Prep | In Progress | Final validation and sign-off |

---

Want to understand why we're doing things a certain way? This section has the answers!
