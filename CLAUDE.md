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
- This is a MVP project
- Start with simplest solution that works
- Don't over-engineer or add unnecessary abstractions
- Hardcode reasonable defaults vs complex config
- Skip edge case handling unless critical
- Ask: "Would copying be easier than generalizing?" If yes, copy.

## Code Changes
- Batch related edits into single operations
- Make minimal edits to accomplish goal
- Commit after each working change
- Use descriptive commit messages

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

<!-- Keep total CLAUDE.md under 500 lines -->