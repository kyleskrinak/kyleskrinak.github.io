---
name: resume-workflow
description: How to work a resume revision with Kyle — editing cadence, resume register and banned words, update triggers, the one-page constraint, and what to ask about rather than decide. Use whenever editing the resume source, its renders, or a tailored variant.
---

# Resume Workflow

This file governs **how** a resume revision proceeds. [docs/features/resume-source.md](../../../docs/features/resume-source.md) governs **which field populates which output**, and [docs/features/resume-variants.md](../../../docs/features/resume-variants.md) covers tailored variants. Read the data-flow document before editing; this one does not repeat it.

The resume is revised quarterly, so every rule here assumes a future session arriving with no memory of the last revision.

## Editing cadence

- Work one section at a time. Stop after each change for direction.
- Apply changes without narrating tool commands.
- When Kyle is choosing language, present two to four options with the reasoning attached to each.
- Do not re-raise settled sections or re-flag items already discussed.

Verify writes per the Verification Protocol in [CLAUDE.md](../../../CLAUDE.md) — grep the file and confirm against disk. Tool echo is not confirmation.

## Register

Professional and compressed. This is **not** the blog's reflective voice; do not carry [blog-voice](../blog-voice/SKILL.md) conventions over wholesale.

- Active voice throughout. Accomplishments lead with the verb.
- "Honest" and "honestly" are banned in any framing. "Genuinely" only when it earns its place.
- Precise word over common word.

## The one-page constraint

One page in print is a constraint, not a suggestion. When content exceeds the page, **propose cuts**. Never shrink the type below readability to force a fit.

For variants, reduce job bullets first via `max_bullets_per_entry`, `include_facets`, or `exclude_facets`; trim `include_certs` or `include_skills` only if those caused the overflow.

## Update triggers

A revision is warranted by any of:

- A role or title change
- A new certification
- A completed project worth citing
- The quarterly staleness check

The quarterly check is automated — [resume-review-reminder.yml](../../../.github/workflows/resume-review-reminder.yml) opens an issue at each quarter start. Do not also flag staleness at session start; the issue is the trigger.

## Decisions that are Kyle's, not yours

- **Section hierarchy.** Rendering is yours; order and hierarchy are his. Never restructure section order without asking.
- **Continuing education.** Kyle pursues ongoing coursework. Whether a given item *appears* on the resume is a judgment call raised during a revision, not a settled field. Track it in frontmatter regardless — `education[].render` defaults to `false` precisely so an item can be recorded without rendering.
- **Baseline updates.** Visual-regression baselines are never updated without asking first.

## Mistakes to avoid

- Do not invent accomplishments, dates, metrics, or title details. Ask.
- Do not let the web and print renders drift. One source, two renderings — a change that lands in one and not the other is a defect, not a variation.
- Do not propose deleting a structured frontmatter field as a duplicate of the body text. Those fields exist so one edit reaches every render.
- Do not add certification data to the resume source. It lives in `scripts/data/certifications.json` by decision.
- Do not cross-validate `skills_inventory` category ids against `FACETS`. They are separate vocabularies on purpose.
