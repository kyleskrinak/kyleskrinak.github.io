# Project Context

<!-- Keep this section under 200 words total -->

## Overview
A modern, fast, and accessible personal blog built with Astro. Migrated from Jekyll with improved performance, featuring full-text search, dark mode, and visual regression testing.
Tech stack: Astro, TypeScript, Tailwind CSS, Pagefind, Playwright

## Key Files
- Primary source: `src/`
- Tests: `tests/` (Playwright visual & functional tests)
- Design assets: `design/` (graphic source files, not deployed)
- Config: `astro.config.ts`, `playwright.config.ts`
- Documentation: `docs/` (comprehensive project docs)

## Forbidden Directories
DO NOT read or reference files in:
- `node_modules/`, `vendor/`, `.git/`
- `dist/`, `build/`, `coverage/`
- `docs/` (unless specifically requested)
- `*.log`, `*.lock`, package-lock.json

---

# Token Optimization Rules

## Context Management
- Ask me before reading files >500 lines
- Read only files directly relevant to current task
- Use grep/search before reading entire files
- Summarize findings concisely

## Development Philosophy

### Code Categories
**MVP Features** (UI, content, blog posts):
- Simple solutions, iterate fast
- Hardcode reasonable defaults
- Don't over-engineer

**Infrastructure** (scripts, build, CI/CD, tooling):
- Production-grade from start
- Configurable (not hardcoded)
- Proper error handling required
- Must work in CI/CD environments
- Resource cleanup (try/finally for processes/connections)

### General Principles
- Start with simplest solution that works
- Don't add unnecessary abstractions
- Skip edge case handling unless critical
- Ask: "Would copying be easier than generalizing?" If yes, copy.

## Code Changes
- Batch related edits into single operations
- Make minimal edits to accomplish goal
- Commit after each working change
- Use descriptive commit messages

## Verification Protocol

**After making ANY code change:**

1. **Search for ALL instances** before claiming "fixed"
   ```bash
   # Before fixing:
   grep -rn "pattern" src/ scripts/ public/

   # After fixing ALL instances:
   grep -rn "pattern" src/ scripts/ public/  # MUST return zero results
   ```

2. **Check side effects:**
   - Documentation referencing changed files?
   - PR description mentioning changed behavior?
   - Related files with similar patterns?
   - Other files in same directory?

3. **Never commit without verification**

## Review Response Protocol

**When addressing review comments:**

1. **Identify ROOT issue, not just the line**
   - Comment mentions line 25 → Find the pattern/issue CLASS
   - Example: "Line 25 uses /" → Issue is "hardcoded root paths break BASE_URL"

2. **Search for ALL instances of that issue**
   ```bash
   grep -rn 'href="/"' src/ public/ scripts/
   ```

3. **Fix ALL instances in ONE commit**

4. **Verify zero results remain**

5. **Update related artifacts** (docs, PR description, tests)

**Never fix "just that line" - fix the entire issue class.**

## Communication Style
- Provide clear, numbered steps for complex tasks
- State assumptions upfront
- Ask clarifying questions before exploration
- Summarize findings in <100 words when possible

---

# Project-Specific Guidelines

# Extended Instructions

For detailed workflows, see:
- Complex workflows → Use custom skills in `.claude/skills/`
- Specific tasks → Use slash commands in `.claude/commands/`
- Automation → Use hooks in `.claude/hooks/`

---

# Blog Writing Rules

## Voice & Prose
- **DO NOT** rewrite my narrative voice or prose
- **DO NOT** "improve" my writing style
- Your job is to identify problems, not fix my voice

## Feedback Approach
- Flag logic gaps and weak transitions - do not silently fix them
- Point out issues and explain WHY they're problems
- Leave the actual fixing to me
- Be specific about locations (paragraph numbers, sections)

## What You Can Edit Directly
- Grammar corrections (typos, punctuation, subject-verb agreement)
- Markdown formatting issues
- Only when explicitly asked: "apply grammar corrections"

## Factual Claims
- Any factual claims must be sourced when verified
- Flag anything unverifiable - don't guess or assume
- Prefer primary sources over secondary
- Note when information might be time-sensitive

## Review Structure
When reviewing drafts, follow this priority:
1. Logic and argument flow first
2. Structure and transitions second
3. Clarity and precision third
4. Grammar and polish last

## Available Commands
- `/outline` - Generate structured outline from topic or notes
- `/review` - Review draft for logic and flow (no rewriting)
- `/factcheck` - Verify claims with web search and provide sources

<!-- Keep total CLAUDE.md under 500 lines -->