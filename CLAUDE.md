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
- If I asked to "fix" or "implement" → Proceed with action.

**Never guess what I want. Never add unrequested complexity. Never skip requested discussion.**

If my instruction is unclear, ask what I want. Don't assume.

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

## Git Workflow

### Branch Structure
- **Three long-lived branches** (never delete): `develop` → `staging` → `main`
- All changes flow: develop → staging → main via pull requests

### Before Making Changes
**ALWAYS sync local branches with origin first:**
```bash
# Sync the branch you're working on
git checkout develop
git pull origin develop
```

**To sync all branches:**
```bash
git checkout main && git pull origin main
git checkout staging && git pull origin staging
git checkout develop && git pull origin develop
```

### Making Changes
1. Ensure you're on `develop` branch and synced
2. Make your changes
3. Commit with descriptive messages
4. Push to origin: `git push origin develop`
5. Create PR: `develop` → `staging`
6. After staging approval, create PR: `staging` → `main`

### PR Review Fixes
- Commit fixes to the **PR's HEAD branch**, not develop
- Example: Comments on PR (staging→main) → fix on `staging` branch
- If fixes were made on wrong branch, cherry-pick to correct branch

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

3. **Quality Gates - MANDATORY before pushing:**
   ```bash
   npm run build
   npm run check:links
   npm run test:visual
   ```
   - All three MUST pass before git push
   - If any fail, fix and re-run all three
   - Never push without running these tests
   - "I'll let CI catch it" is NOT acceptable

4. **Never commit without verification**

## Text Processing & Parsing Rules

**When implementing text parsing, string manipulation, or range-based operations:**

### Critical Implementation Rules
1. **Range boundaries**: Use exclusive end (`pos < range.end`). Closing delimiters already included.
2. **Offset calculation**: Account for newlines. Use running offset, never `join('\n').length`.
3. **String removal**: NEVER use `.replace(substring, '')` on potentially duplicate content. Store position ranges, slice, rebuild.
4. **Cross-platform**: Always `.trim()` before exact string comparison (CRLF vs LF).
5. **Malformed input**: Handle unclosed blocks/tags — if still in block after scan, extend range to `content.length`.
6. **Error handling**: Throw errors for missing expected resources. Don't silently return empty arrays.

### Edge Cases Checklist (Text Processing)
Before committing parsing/text manipulation code, verify:
- [ ] Handles malformed input (unclosed blocks, missing delimiters)
- [ ] Works with CRLF line endings (uses `.trim()`)
- [ ] Handles duplicate content in different contexts (code blocks vs actual content)
- [ ] Uses position-based manipulation, not string matching
- [ ] Range boundaries are exclusive end, offsets include newlines
- [ ] Fails fast for missing resources (throws, doesn't hide problems)

### Data Validation Rules
- [ ] Apply `.trim().min(1).optional()` consistently to ALL text fields
- [ ] Distinguish validation context (on-page vs metadata, interactive vs static)
- [ ] Security: Use blocklists for dangerous protocols, not allowlists (allowlists block valid relative URLs)

### Web Performance Rules
- [ ] `sizes` attribute must match actual container width, not viewport width
- [ ] Always include `width`/`height` on images (including SVGs) for CLS prevention

## Dependency/Tool Change Protocol

**MANDATORY when removing, replacing, or consolidating tools/dependencies:**

1. **Search documentation for references:**
   ```bash
   # Search for tool name in docs
   grep -rn "tool-name" docs/ README.md

   # Search for related concepts
   grep -rn "workflow.*name\|feature.*description" docs/
   ```

2. **Update ALL found references:**
   - [ ] README.md - Update command examples, tech stack
   - [ ] docs/index.md - Update navigation and file lists
   - [ ] Feature-specific docs (e.g., docs/link-checking.md)
   - [ ] Workflow documentation - Explain new approach
   - [ ] Architecture docs - Update system diagrams/descriptions

3. **Search tests for references:**
   ```bash
   grep -rn "tool-name" tests/
   ```

4. **Verify completeness:**
   - [ ] No orphaned references to old tool
   - [ ] New tool/approach fully documented
   - [ ] Automated workflows documented (if applicable)
   - [ ] Migration path explained (if relevant)

**Example scenario:**
- Removed: broken-link-checker
- Added: htmltest + Playwright two-tier system
- Must update: docs/link-checking.md, docs/index.md, README.md
- Must search for: "broken-link-checker", "linkwatch", "external link"

**This is NOT optional. If you change tools, you MUST update docs.**

5. **Test critical paths of new implementation:**
   - [ ] For workflows: Verify conditional logic (if: failure(), continue-on-error, exit codes)
   - [ ] For scripts: Test happy path and error conditions
   - [ ] For automation: Verify it triggers correctly
   - [ ] Common gotchas: continue-on-error + if: failure() won't work (capture exit code instead)

6. **Verify accuracy of documentation you write:**
   - [ ] Test commands you document (don't assume what they do)
   - [ ] Verify script/command behavior matches documentation
   - [ ] Check package.json scripts match what docs claim

7. **Remove obsolete code:**
   - [ ] Delete unused scripts/files from old approach
   - [ ] Search for orphaned utilities: `ls scripts/*.js` and verify each is used
   - [ ] Clean up old config files

## Pre-Commit Completeness Checklist

**Before committing, verify ALL boxes:**

**Pattern Completeness** (if implementing similar to existing code):
- [ ] Read the COMPLETE existing implementation (code + tests + comments + docs)
- [ ] Check for tests - add equivalent tests
- [ ] Check for explanatory comments - add equivalent comments
- [ ] Check for documentation - add equivalent docs
- [ ] Compare side-by-side: match quality/completeness of existing code

**Systemic Impact** (ask: "What OTHER systems interact with this?"):
- [ ] Search codebase for related functionality
- [ ] For SEO changes: check meta tags, sitemap, robots.txt, canonical tags
- [ ] For any change: check tests, docs, configs, similar files

**Text Processing & Parsing** (if code manipulates strings, ranges, or parses text):
- [ ] Followed all rules in "Text Processing & Parsing Rules" section
- [ ] Verified all items in "Edge Cases Checklist (Text Processing)"
- [ ] Used position-based manipulation, not string matching
- [ ] Handles malformed input, CRLF, and duplicate content

**Test Coverage**:
- [ ] Does similar functionality have tests? Add equivalent tests
- [ ] Do tests cover edge cases? (null, undefined, privacy signals, etc.)
- [ ] Do tests match implementation completeness?

**Documentation Parity**:
- [ ] Do similar implementations have explanatory comments? Add them
- [ ] Do comments explain "why" not just "what"?
- [ ] Is there docs/ content for this feature? Update it
- [ ] Search docs/ and README.md for references to changed code
- [ ] Update docs/index.md if adding/removing major features
- [ ] If replacing a tool: Search and update ALL mentions of old tool

**Final Check - Can you answer YES to all:**
1. ✅ Fixed the specific issue
2. ✅ Found and fixed ALL instances of the pattern
3. ✅ Added tests matching similar features
4. ✅ Checked ALL interacting systems
5. ✅ Matched completeness of similar implementations
6. ✅ Added explanatory comments matching project style
7. ✅ Searched docs/ and README.md and updated relevant sections
8. ✅ If removed/replaced tool: No orphaned references remain
9. ✅ Tested critical paths (workflows trigger correctly, scripts work, commands run)
10. ✅ Verified documentation accuracy (tested what you documented)
11. ✅ Removed obsolete code/scripts from old approach

**If you can't check all boxes, you're not done.**

## Review Response Protocol

**When addressing review comments:**

1. **Identify ROOT issue, not just the line**
   - Comment mentions line 25 → Find the pattern/issue CLASS
   - Example: "Line 25 uses /" → Issue is "hardcoded root paths break BASE_URL"

2. **Identify the PATTERN type:**
   - Missing tests? → Check ALL features for test coverage gaps
   - Missing comment? → Check ALL similar code for comment patterns
   - Systemic gap? → Map ALL affected systems (sitemap, robots.txt, etc.)
   - Inconsistency? → Find what it should match and ensure parity

3. **Search for ALL instances of that issue**
   ```bash
   grep -rn 'href="/"' src/ public/ scripts/
   ```

4. **Fix comprehensively in ONE commit**
   - Fix the specific issue mentioned
   - Fix all instances of the pattern
   - Add missing tests/comments/docs to match existing code
   - Update all interacting systems

5. **Verify completeness:**
   - Zero results for pattern search
   - Test coverage matches similar features
   - Documentation matches similar features
   - All affected systems updated

**Never fix "just that line" - fix the entire issue class with full completeness.**

## Communication Style
- Provide clear, numbered steps for complex tasks
- State assumptions upfront
- Ask clarifying questions before exploration
- Summarize findings in <100 words when possible
- Skip unnecessary engagement phrases ("You're right!", "Perfect!", "Good catch!")
- Be direct and concise — just state what you're doing or what needs to be done (but ONLY if I asked you to do it)

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