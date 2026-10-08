---
name: blog-workflow
description: The four-phase model for developing a blog post from idea to shipped piece, plus hero-image conventions, per-platform social teaser register, and the supporting work every post ships with. Use when brainstorming, outlining, drafting, or reviewing a post for kyle.skrinak.com.
---

# Blog Post Workflow

Four phases, in order. Phase transitions are Kyle's call, not a fixed checkpoint — never advance on your own initiative.

## Phase One: Brainstorm

Kyle brings something he wants to explore. Ask sharp questions to help him think it through. No rush to conclusions, no drafting, no outline. When the shape feels solid enough, he says so and you move on.

Before starting, check the Notion "Blog Backlog" database for this piece's existing entry rather than assuming a blank slate. The backlog tracks every idea by status (idea, drafting, posted) with a next-action note and, once published, a Post URL. Each entry is a Notion page, and the draft is written into that page's body as it develops — no separate draft page, no child page. When a piece changes phase or ships, update its status and next action to match.

The repo automates the Notion side: [migrate-notion-post.mjs](../../../scripts/migrate-notion-post.mjs) pulls a finished draft into a post and opens a PR via [notion-migrate.yml](../../../.github/workflows/notion-migrate.yml), and [notion-writeback.mjs](../../../scripts/notion-writeback.mjs) closes the loop back to the backlog entry. The database id lives in the `NOTION_BLOG_BACKLOG_DATA_SOURCE_ID` repository variable.

`/brainstorm` is the entry point for this phase.

## Phase Two: Outline

Build the outline section by section, working through structure and order together. `/outline` implements this phase — use it rather than restating its rules.

## Phase Three: Section Drafting

Draft one section at a time. After each section, Kyle reviews and proposes tweaks; step through changes one at a time and never skip ahead. Stop after each change for direction.

- Ask clarifying questions when context is ambiguous.
- When Kyle is choosing language, present two to four options with the reasoning attached to each.
- Read critically. Push back where logic limps and where assumptions aren't earned. Argue the case when an edit regresses the piece.
- Do not re-raise settled passages or re-flag items already discussed.
- Apply changes without narrating tool commands.
- Do not stop after one task when more editorial notes remain.

## Phase Four: End-to-End Review

On request, fetch the document fresh and read it through for consistency, flow, grammar, and active voice throughout. No passive voice. Verify URLs and factual claims before they ship. `/review` and `/factcheck` implement this phase.

Review in this order:
1. Logic and argument flow
2. Structure and transitions
3. Clarity and precision
4. Grammar and polish

Source verifiable claims; flag anything unverifiable. Prefer primary sources; note time-sensitive information.

## Post Files

- Blog posts are co-located directories: `src/content/blog/YYYY-MM-DD-lowercase-kebab-slug/index.md`, with the post's images beside that `index.md` and referenced as `./image.webp`.
- Scaffold with `npm run new-post -- <slug>`; add `--images <dir>` to convert a folder of images to WebP and co-locate them.
- `getPath()` uses `post.id` directly (no lowercasing) — wrong case causes 404s on Linux CI even if macOS hides it.

## Hero Images

Pre-1925 art in the US public domain. Dark, contemplative, atmospheric visual register. Caption format is artist, title, year, followed by a dry personal caption that does not over-explain the connection to the piece.

## Supporting Work Every Post Ships With

- Title
- Hero image with caption
- Citations
- A PS where one is warranted
- Social teasers calibrated per platform
- Substack cross-post

## Per-Platform Register for Teasers

| Platform | Register |
|---|---|
| Facebook | Enters through the personal, human door — the low-carb group register |
| LinkedIn | Leads with craft and stated claims, written for skimmers |
| X | Leads on system failure or institutional contradiction, without becoming outrage bait |
| Substack | Runs truest to the reflective voice |

## Mistakes to Avoid

- Do not invent facts that were not given. Ask before writing a detail in.
- Do not overstate contrarian science. Know the difference between a mainstream-defensible claim and a minority-view claim that would undermine credibility.
- Do not presume motive when Kyle asks for analysis. Name what you are analyzing, not why you think it happened.
