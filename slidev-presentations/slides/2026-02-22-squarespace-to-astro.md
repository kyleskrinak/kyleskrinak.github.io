---
theme: default
title: AI-Accelerated CMS Migration with Claude Code
date: 2026-02-22
tags: [ai, claude-code, astro, migration, squarespace]
---

# AI-Accelerated CMS Migration with Claude Code
From Squarespace to Astro in eight hours

<!--
This is a case study in applying disciplined project management to an AI-accelerated workflow. The goal isn't to sell Claude Code — it's to show what becomes possible when you manage AI the way you'd manage any capable but literal contractor.
-->

---

<div style="text-align: center;">
  <img src="/assets/images/2026-03-02-squarespace-to-cf-pages.webp" alt="Squarespace to Cloudflare Pages migration workflow" style="max-width: 90%; height: auto; margin: 0 auto; display: block;">
  <p style="margin-top: 1rem; font-style: italic; color: #222; font-size: 1.1em;">original site — migrated site</p>
</div>

---

## The Situation

My wife Elena runs a graphic design business — **[skrinakcreative.com](https://skrinakcreative.com)**

- On Squarespace since 2017
- Squarespace worked well
- Her business downsized
- Seven pages, portfolio galleries, minimal interactivity
- **$16–23/month → $0**

<!--
We migrated to Squarespace from Drupal in 2017 — it was the right call then. This migration isn't a verdict on Squarespace. The business circumstances changed, making it practical for me to manage the site directly. Free hosting made the decision easy.
-->

---

## What I Considered First — HTTrack

Web scraping is the obvious starting point. I know HTTrack well.

- Used HTTrack + AI as a first attempt
- Results were unusable
- Platform-coupled assets would require significant decoupling effort
- Unclear IP standing on scraped theme assets
- Enough friction to make me curious about a cleaner approach

<!--
HTTrack is a solid, well-respected tool for static sites. Its fundamental limitation is that it doesn't execute JavaScript — meaning any JavaScript-rendered content may not scrape cleanly. That could have been a problem here. Beyond the technical friction, I wasn't confident about the IP status of theme assets, fonts, and third-party integrations bundled by Squarespace. Rather than untangle that, it was cleaner to leave it behind entirely.

Worth noting for the technically curious: this JavaScript limitation applies to React and Vue-based sites as well. HTTrack predates the JavaScript-rendered web and has no headless browser capability.
-->

---

## The Constraint — Know Your Scope

This was a **simple** migration. Knowing that upfront matters.

- 7 pages, single grid-based theme
- One integration swap: Google Maps → OpenStreetMap
- No forms, no authentication, no e-commerce
- No CMS data model to untangle

<!--
Even one contact form meaningfully raises complexity — it requires a backend decision, a service integration, and validation logic. Scope definition isn't just good practice here; it's the prerequisite for everything that follows. This was always a conversion, not a lift and shift. The more clearly you define what's in and out, the more reliably AI executes.
-->

---

## The Approach — Discipline Before Code

Classic project management applied to an AI-accelerated workflow.

Before any code was written:

1. **Plan** — goals ranked by priority, options evaluated
2. **Scope** — seven pages, exact asset inventory, known integrations
3. **Specification** — design tokens, typography, color palette, spacing
4. **Testing requirements** — visual regression baselines, pass criteria defined

<!--
This is the part that made AI reliable rather than chaotic. The project paradigm didn't slow things down — it removed the conditions under which AI fails. When I've been lazy in AI interactions, I've actually just been providing insufficient context. Same thing.
-->

---

## The Stack Decision

**Astro + Cloudflare Pages**

| Decision | Choice | Rationale |
|---|---|---|
| Hosting | Cloudflare Pages | Free tier, global CDN, auto-deploy from git |
| Framework | Astro | Native image optimization, clean component model |
| Theme | None — built from scratch | Existing themes didn't match Elena's design |
| Font | Jost (Google Fonts) | Adobe Fonts license lost on Squarespace cancellation |
| Lightbox | GLightbox | Matched portfolio gallery behavior exactly |

<!--
I wanted to evaluate Cloudflare Pages — I hadn't used it before. Unlimited bandwidth, automatic HTTPS, and git-based deploys on the free tier. Satisfied with that choice.

Astro's image component handles WebP conversion and lazy loading natively — important for an image-heavy design portfolio. The blank Astro starter was the right call; existing themes all required more adaptation than building clean from scratch. That decision echoes the blank theme approach from Drupal days.

The font substitution was unavoidable. Adobe Fonts licenses are bundled with the Squarespace subscription and don't transfer on cancellation. Jost is a close geometric match for Futura PT. Elena noticed the difference; we discussed it; she accepted the tradeoff.
-->

---

## What Claude Code Actually Did

Claude Code wrote **all of it**. My role was project management.

- Discovery & audit, technology evaluation, design spec extraction
- Astro scaffold, component build, gallery implementation
- Visual alignment, test suite, deployment configuration

**The standout:** Layout identification and visual alignment

> Describing design corrections in plain English, with a visual comparison test suite confirming each change against the live Squarespace baseline.

<!--
Seven phases, all dramatically improved in quality and execution time compared to working alone. The most tangible demonstration was the visual alignment work — describing corrections conversationally and watching the test suite confirm each change. That combination of natural language interaction and automated verification changed the character of this kind of work.
-->

---

## The Test Suite

78 tests. Claude Code wrote them.

- **60 visual regression tests** — 7 pages × 3 breakpoints × 2 test types
- **18 navigation tests** — desktop and mobile, dropdown and drawer behavior
- Playwright baselines pulled from the live Squarespace site

> I already take parallel test suite management for granted. That shift happened fast.

<!--
Elena has a designer's eye and exacting standards. The test suite gave us a shared, objective reference — when I flagged something or she reviewed the result, we could verify it, fix it, and confirm the fix. That workflow only exists because tests were required upfront, not added at the end.
-->

---

## The Numbers

**Total time: 8 hours** — start to deployed.

- ~1 hour lost to a Cloudflare DNS configuration miss
- A clean run: probably **7 hours**

| Metric | Squarespace | Astro | Δ |
|---|---|---|---|
| Performance | 57 | 86 | **+29** |
| Accessibility | 96 | 99 | +3 |
| Best Practices | 100 | 100 | — |
| SEO | 93 | 92 | -1 |

<!--
The DNS miss is worth naming. I'd added skrinakcreative.com as the custom domain in Cloudflare Pages but not www.skrinakcreative.com. Claude Code didn't catch it and suggested every possible fix except the right one. I stepped away and figured it out in idle time. AI-generated instructions fail — sometimes expensively. That's not a reason to avoid AI; it's a reason to verify, especially on infrastructure configuration. Eight hours total is still not a number that was realistic before.
-->

---

## The Results

Deployed. Stakeholder approved.

- Elena signed off — she cares about the design, not the tech
- Not pixel-perfect: font substitution accounts for most of the gap
- Better on every meaningful performance dimension
- Full control, no vendor lock-in

<!--
Stakeholder approval here means something specific: Elena has a professional designer's eye, cares deeply about how the site looks, and had no patience for "good enough for a migration." The result cleared that bar. That's the meaningful test.
-->

---

## Project Scope

This was the simple case. Extrapolate carefully.

- 7 pages, one theme, one clean integration swap
- Complexity scales with forms, data models, authentication
- AI instructions fail — verify infrastructure configuration yourself

> Prior assumptions about effort may no longer hold. Test it yourself.

<!--
Five or more years in web tech means you've watched "this will be complicated" become "oh, that's it?" repeatedly as tooling matures. The honest position isn't a warning — it's an open question. The floor of what AI handles trivially keeps rising.
-->

---

# The Takeaway

**Context is the input. Quality is the output.**

- Define scope before you start
- Write specs before you build
- Require tests before you ship
- Manage AI like a very fast, very literal contractor

> The question isn't whether AI can do this. It's whether *you* can manage it well enough to let it.

<!--
When AI underperforms, the failure is usually traceable to insufficient context. Discipline isn't a constraint on AI-accelerated work — it's what makes the acceleration reliable.
-->

---

# Questions?

**See it live**
- [skrinakcreative.com](https://skrinakcreative.com) — production site, now running on Astro
- [elena-skrinak-md37.squarespace.com](https://elena-skrinak-md37.squarespace.com) — original Squarespace site, available until September 12, 2026

**Read the full story**
- [From Squarespace to Astro: A Migration Story](https://kyle.skrinak.com/posts/2026-03-02-from-squarespace-to-astro/) — full narrative with project context, decision-making process, and lessons learned

**The stack**
- [Astro](https://astro.build) · [Cloudflare Pages](https://pages.cloudflare.com) · [GLightbox](https://biati-digital.github.io/glightbox/)
- [Claude Code](https://claude.ai/code)
