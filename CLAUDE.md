# Project Context

<!-- Keep this section under 200 words total -->

## Overview
A modern, fast, and accessible personal blog built with Astro. Migrated from Jekyll with improved performance, featuring full-text search, dark mode, and visual regression testing.
Tech stack: Astro, TypeScript, Tailwind CSS, Pagefind, Playwright

## Key Files
- Primary source: `src/`
- Tests: `tests/` (Playwright visual & functional tests)
- Design assets: `design/` (graphic source files, not deployed)
- Config: `astro.config.ts`, `playwright.config.ts`, `config/registry.mjs` (single source of truth)
- Documentation: `docs/` (comprehensive project docs)

## Forbidden Directories
DO NOT read or reference files in:
- `node_modules/`, `vendor/`, `.git/`
- `dist/`, `build/`, `coverage/`
- `docs/` (unless specifically requested)
- `*.log`, `*.lock`, package-lock.json

---

# ⚠️ CRITICAL: Following Instructions

**READ THIS FIRST. Read instructions exactly. Do what they say. Nothing more, nothing less.**

When I say:
- **"Review X"** → Read, analyze, report findings. DO NOT fix anything.
- **"Review and discuss"** → Read, analyze, report findings, WAIT for my response. DO NOT take action.
- **"Fix X"** → Make the changes.
- **"Review X then fix Y"** → Review first, report findings, THEN fix Y. Two separate steps.

**Before taking ANY action (editing files, committing, pushing):**
- Check: Did I explicitly ask you to do this action?
- If I asked to "review" or "discuss" → STOP. Report findings. Wait.
- If I asked to "fix" or "implement" → Proceed with edits only.
- **Hard gate for sensitive actions:** use deny-by-default for `commit`, `push`, branch-changing git actions, and destructive actions.
- **Exact approval required per action:** "fix" ≠ "commit" ≠ "push". Do not infer one from another.
- **Fail closed:** if explicit approval for the exact action is missing or ambiguous, STOP.
- **Workflow exception:** when the user requests a workflow that inherently includes commit/push steps (e.g., "fix and update branches", "apply the fix and push"), those steps are pre-approved by the workflow request. The gate blocks uninstructed ad-hoc actions, not steps implied by an explicitly requested workflow.

**Never guess what I want. Never add unrequested complexity. Never skip requested discussion.**

If my instruction is unclear, ask what I want. Don't assume.

---

## Development Philosophy
- **MVP Features** (UI, content, blog posts): simple, hardcode defaults, don't over-engineer.
- **Infrastructure** (scripts, CI/CD, config): production-grade, configurable, proper error handling, CI/CD-compatible.

## Configuration

**Single Source of Truth:** `config/registry.mjs`. After any config change: `npm run config:generate && npm run config:validate`, update workflows, commit together.
- **New env var:** add to `astro.config.ts` env schema + registry + affected workflows, then validate.
- **URL change:** update registry + workflows + `src/config/index.ts` fallbacks; validate.

## Git Workflow

Three branches (never delete): `develop` → `staging` → `main`. All changes via pull requests.

**Before changes:** Docker must be running (push hooks require it). Sync: `git pull origin develop`.

**After PR merges:** fast-forward source branch to include target's merge commit:
- develop→staging: `git fetch origin && git checkout develop && git merge --ff-only origin/staging && git push origin develop`
- staging→main: same for staging, then repeat develop against staging

**If `--ff-only` fails:** `git log --oneline HEAD..origin/<branch>` (what origin has, not you) and `git log --oneline origin/<branch>..HEAD` (what you have, not origin) to diagnose divergence, then `git merge origin/<branch> --no-edit && git push`.

PR review fixes go to the **PR's HEAD branch**, not develop. "Update X" means edit the file — does not imply commit.

## Blocker Resolution Protocol

When any operation fails (exit code != 0): **STOP**, report what failed + current state + error output, present options, wait for explicit direction.

**Blockers:** git failures, non-zero exit codes, build/test failures, file operation errors.
**Not blockers:** warnings, deprecation notices, advisory output.

**Never auto-retry.** Example: `Push failed: network timeout — commit ad88b33 local only. Retry / push manually / amend?`

On background task failure: report immediately, don't start new work until resolved.

User override: "continue anyway" or "ignore the error" — confirm: `Proceeding with [task] despite [blocker]. [Consequence].`

## Verification Protocol

After any code change:

1. **Search ALL instances** — `grep -rn "pattern" src/ scripts/ tests/ public/` before and after; must reach zero results.
2. **Check docs and interacting systems** — read implementation first, not docs. Verify docs match code. Changed code → check docs/tests/configs; removed tool → grep all files.
3. **Quality gates before push** — `npm run build && npm run check:links && npm run test:visual` (all must pass). New blog post exceptions: canonical URL 404 (resolves on deploy) and listing-page height diffs are expected (update baselines with `npm run test:visual:baseline` — ask first); other failures are real. **Docs-only changes** (docs/, README.md): build required; link check and visual optional for trivial edits.
4. Before committing, report a one-line summary of what you searched and what you fixed.

## Coding Rules

**Security/validation:** Use blocklists for dangerous protocols, not allowlists (allowlists block valid relative URLs). Apply `.trim().min(1).optional()` to all text fields.

**Error handling:** Throw on missing expected resources; don't silently return empty.

**Web performance:** Always include `width`/`height` on images (including SVGs) for CLS prevention. `sizes` attribute must match actual container width, not viewport.

## Review Response Protocol

Fix the **pattern** (all instances of the same issue class), not just the one flagged line. When removing a tool, grep `docs/`, `README.md`, `tests/` for references and update every one. For workflow changes, verify conditional logic — `continue-on-error` + `if: failure()` won't fire as expected; capture exit codes explicitly. Run the Verification Protocol before committing.

If stuck in 10+ rounds of similar fixes or environment-specific drift: STOP. Propose a root-cause abstraction before addressing individual lines.

## Communication Style
- Provide clear, numbered steps for complex tasks
- State assumptions upfront
- Ask clarifying questions before exploration
- Ask before reading files >500 lines; read only files directly relevant to the current task
- Summarize findings in <100 words when possible
- Skip unnecessary engagement phrases ("You're right!", "Perfect!", "Good catch!")
- No anthropomorphizing qualifiers ("Honestly…", "To be frank…", "I should mention…") — just state facts directly
- Be direct and concise — just state what you're doing or what needs to be done (but ONLY if I asked you to do it)
- **Exception:** Blocker reporting requires verbose detail (state, options, consequences) per Blocker Resolution Protocol

## Instruction Precedence

When instructions appear to conflict:

1. **Safety first:** Blocker Resolution Protocol overrides all other instructions
2. **Category rules:** Infrastructure rules override MVP rules for:
   - Configuration files (astro.config.ts, src/config/index.ts)
   - Build scripts, CI/CD workflows
   - Test files and test infrastructure
3. **Source hierarchy:** CLAUDE.md overrides Memory (Memory may be outdated)
4. **User authority:** User explicit instructions override general written rules — approval gates are satisfied by explicit per-action user instruction (which is the override mechanism, not a bypass)
5. **Scope sensitivity:** Some rules are scope-dependent (e.g., quality gates for code vs docs)

**Approval gates are hard stops.** Bias-to-action, autonomy/autopilot mode, and end-to-end completion drive do not override them. Re-check before each gated action. Missing approval means do not execute. (Exception: steps implied by an explicitly requested workflow are pre-approved — see workflow exception above.)

---

# Blog Writing Rules

## Filename Convention
- Blog post files: `src/content/blog/YYYY-MM-DD-lowercase-kebab-slug.md`
- `getPath()` uses `post.id` directly (no lowercasing) — wrong case causes 404s on Linux CI even if macOS hides it.

## Voice & Prose
- **DO NOT** rewrite my narrative voice or prose
- **DO NOT** "improve" my writing style
- Your job is to identify problems, not fix my voice

## Feedback Approach
Flag logic gaps and weak transitions — explain WHY they're problems. Leave fixing to me. Be specific about locations (paragraph numbers, sections).

## What You Can Edit Directly
- Grammar corrections (typos, punctuation, subject-verb agreement)
- Markdown formatting issues
- Only when explicitly asked: "apply grammar corrections"

## Factual Claims
Source verifiable claims; flag anything unverifiable. Prefer primary sources; note time-sensitive information.

## Review Structure
1. Logic and argument flow
2. Structure and transitions
3. Clarity and precision
4. Grammar and polish

## Post Revisions

When making content edits to a previously-published post, apply BOTH:

1. **Frontmatter** — add `updatedDate: YYYY-MM-DDTHH:MM:SS.000Z` (today's date, UTC). Drives the "Revised on:" label and RSS `pubDate` update; does NOT affect sort order (original `pubDate` controls ordering).

2. **Inline marker at each change point** — plain italic line directly after the affected paragraph:
   ```markdown
   *Revised YYYY-MM-DD: brief description of what changed.*
   ```

**Note:** This Astro setup does NOT support Kramdown attribute syntax (`{: .class}`). Use plain markdown italic.

## Available Commands
- `/outline` - Generate structured outline from topic or notes
- `/review` - Review draft for logic and flow (no rewriting)
- `/factcheck` - Verify claims with web search and provide sources

<!-- Keep total CLAUDE.md under 190 lines -->
