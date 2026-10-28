---
name: resume-workflow
description: How to work a resume revision with Kyle — editing cadence, resume register and banned words, update triggers, the one-page constraint, and what to ask about rather than decide. Use whenever editing the resume source, its renders, or a tailored variant.
---

# Resume Workflow

The rubric this workflow enforces is documented in [`docs/references/manager-tools-rubric.md`](../../../docs/references/manager-tools-rubric.md). Read it before evaluating accomplishment bullets.

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

One page in print is a constraint, not a suggestion. When content exceeds the page, **propose cuts**, least relevant accomplishments first. When the page has room, propose adding an accomplishment; ask Kyle for it rather than writing one. No print text goes below 11pt except the admin line's 10.5pt Arial Bold (Kyle's exception), and type never shrinks to force a fit.

Each accomplishment and each admin line fits on one printed line. `scripts/lib/resume-render.mjs` fails the render and writes no file when a bullet or admin line wraps or the page runs past one; tighten or cut the lines it names.

One render writes the PDF, .docx and .txt with identical content. Upload the .docx or .txt to an applicant tracking system, never the PDF, and check how the site renders what you upload.

A variant follows every rubric rule and varies only which accomplishments appear, chosen by relevance to the target role. Rank the ones to keep across the whole page in `bullet_order`, most relevant first; narrow by theme with `include_facets` or `exclude_facets`.

## Update triggers

A revision is warranted by any of:

- A role or title change
- A completed project worth citing
- The quarterly staleness check

The quarterly check is automated — [resume-review-reminder.yml](../../../.github/workflows/resume-review-reminder.yml) opens an issue at each quarter start. Do not also flag staleness at session start; the issue is the trigger.

## Decisions that are Kyle's, not yours

- **Section hierarchy.** Section order follows the rubric's Structure section. Rendering is yours; anything the rubric leaves open is his. Never restructure section order without asking.
- **Continuing education.** Kyle pursues ongoing coursework. Whether a given item *appears* on the resume is a judgment call raised during a revision, not a settled field. Track it in frontmatter regardless — `education[].render` defaults to `false` precisely so an item can be recorded without rendering.
- **Baseline updates.** Visual-regression baselines are never updated without asking first.

## Mistakes to avoid

- Do not invent accomplishments, dates, metrics, or title details. Ask.
- Do not let the web and print renders drift. One source, two renderings — a change that lands in one and not the other is a defect, not a variation.
- Do not propose deleting a structured frontmatter field as a duplicate of the body text. Those fields exist so one edit reaches every render.
- Do not put certifications on any resume, tailored variants included. Manager Tools sends a certification the posting requires in the cover letter, which stays outside this repo.
- Do not cross-validate `skills_inventory` category ids against `FACETS`. They are separate vocabularies on purpose.
