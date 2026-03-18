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

**Infrastructure** (scripts, build, CI/CD, tooling, **configuration**):
- Production-grade from start
- Configurable (not hardcoded)
- Proper error handling required (code-level errors; operational failures: see Blocker Resolution Protocol)
- Must work in CI/CD environments
- Resource cleanup (try/finally for processes/connections)
- **Configuration files** (astro.config.ts, src/config/index.ts, env schemas):
  - Must be centralized and validated
  - Abstraction justified when preventing drift/repeated fixes
  - Examples: Config registry, validation scripts, auto-generated docs

### General Principles
- Start with simplest solution that works
- Don't add unnecessary abstractions **unless infrastructure requires it**
- Skip edge case handling unless critical
- Ask: "Would copying be easier than generalizing?" If yes, copy.
- **Exception:** Infrastructure abstractions (config registry, validation) justified when preventing repeated manual fixes

## Configuration Abstraction Layer

**Single Source of Truth:** `config/registry.mjs`

All configuration values (env vars, deployment settings, Astro config) are documented in the registry and validated automatically in CI.

### Validation Coverage

The config validator (`npm run config:validate`) enforces consistency across:

1. **Workflows ↔ Registry**: Environment variables in `.github/workflows/*.yml` must match registry
2. **Env Schema ↔ Registry**: Variables in `astro.config.ts` env schema must be documented in registry
3. **Code ↔ Env Schema**: All `process.env.*` usage must be declared in env schema
4. **Deployment ↔ Registry**: GitHub repository variables (`vars.*`) must match deployment config
5. **Docs ↔ Registry**: Generated docs (`docs/operations/environment-configuration.md`) must be up to date
6. **Hardcoded Fallbacks ↔ Registry**: Literal values in `src/config/index.ts` must match registry

### Design Decisions

**Why `src/config/index.ts` uses `process.env` instead of `astro:env`:**
- Runs at build initialization before Astro env is fully available
- Implements fallback logic for local development
- Hardcoded fallback URLs are **validated** against registry to prevent drift
- Validation-only approach chosen over refactoring for reliability

**When to update configuration:**
1. Change value in `config/registry.mjs`
2. Run `npm run config:generate` to update docs
3. Run `npm run config:validate` to verify consistency
4. Update workflows if needed
5. Commit all changes together

**CI Enforcement:**
- Validation runs in all deployment workflows (PR, staging, production)
- Prevents merging/deploying with configuration drift
- Fails fast with clear error messages

### Common Scenarios

**Adding a new env var:**
1. Add to `astro.config.ts` env schema
2. Add to `config/registry.mjs` environments
3. Add to workflows that need it
4. Run `npm run config:generate && npm run config:validate`

**Changing a URL:**
1. Update in `config/registry.mjs`
2. Update in workflows
3. If used in `src/config/index.ts` fallbacks, update there too
4. Validation will catch mismatches

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
(On conflicts or failure, see Blocker Resolution Protocol)

**To sync all branches:**
```bash
git checkout main && git pull origin main
git checkout staging && git pull origin staging
git checkout develop && git pull origin develop
```
(On conflicts or failure, see Blocker Resolution Protocol)

### Making Changes
1. Ensure you're on `develop` branch and synced
2. Make your changes
3. Commit with descriptive messages
4. Push to origin: `git push origin develop` (on failure, see Blocker Resolution Protocol)
5. Create PR: `develop` → `staging`
6. After staging approval, create PR: `staging` → `main`

### PR Review Fixes
- Commit fixes to the **PR's HEAD branch**, not develop
- Example: Comments on PR (staging→main) → fix on `staging` branch
- If fixes were made on wrong branch, cherry-pick to correct branch (on failure, see Blocker Resolution Protocol)

## Blocker Resolution Protocol

**DEFAULT: When operations fail (exit code != 0 or explicit error):**

1. **STOP immediately** - Do not proceed with other work
2. **Report the failure:**
   - What failed (command, operation, step)
   - Current state (unpushed commits, conflicts, partial completion)
   - Error message/output
3. **Present options** - Give user clear choices for resolution
4. **Wait for explicit direction** - Do not assume, retry, or work around

### What Counts as a Blocker

**STOP on these:**
- Git operations fail (push, pull, fetch, merge returns conflicts)
- Commands return exit code != 0
- Build/test failures
- File operations fail (permission denied, file not found when expected)

**Do NOT stop on these:**
- Warnings (operation succeeds with warnings)
- Deprecation notices
- Successful operations with advisory output

### Retry Logic

**Never auto-retry.** Even for transient failures (network timeout), stop and ask.

Example:
```
Push failed: network timeout
Commit ad88b33 exists locally but not on origin.

Options:
1. Retry push now
2. You'll push manually later
3. Amend or discard commit

What do you want to do?
```

### Background Task Failures

When notified of background task failure:
1. Report immediately in next response
2. Do not start NEW work until resolved
3. Ongoing work can complete

### User Override

User can override by explicitly saying "continue anyway" or "ignore the error."

Before proceeding, confirm understanding:
```
Confirmed: proceeding with [task] despite [blocker].
[Specific consequence of proceeding].
```

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

2. **Verify documentation against source code:**
   - **Read implementation first, not other docs**
   - Every documentation claim → verify in actual code
   - Example: Doc says "analytics load on remote URLs"
     - ❌ Don't trust the doc
     - ✅ Read src/components/GoogleAnalytics.astro to verify actual gating logic
   - Config behavior claims → read astro.config.ts, src/config/index.ts
   - Test behavior claims → read actual test files

3. **Check side effects:**
   - Documentation referencing changed files?
   - PR description mentioning changed behavior?
   - Related files with similar patterns?
   - Other files in same directory?

4. **Quality Gates (scope-dependent):**

   **For code changes (src/, scripts/, config files):**
   ```bash
   npm run build           # MUST pass
   npm run check:links     # MUST pass
   npm run test:visual     # MUST pass
   ```
   All three MUST pass before git push. If any fail, see Blocker Resolution Protocol.

   **For documentation-only changes (docs/, README.md):**
   - Verification steps 1-3 required
   - Quality gates optional if changes are trivial (typo fixes, wording)
   - Use judgment: if doc change affects behavior understanding, run tests

5. **Never commit without verification**

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

## Pre-Commit Verification Protocol

**MANDATORY: Execute and output ALL steps before ANY commit.**

### Step 1: Search for ALL instances (SHOW OUTPUT)

```bash
# Search for pattern in code
grep -rn "pattern-being-fixed" src/ scripts/ tests/ public/

# MUST show: "0 results" or "found N, fixing all N"
```

**OUTPUT REQUIRED**: Show grep results. If N>0, fix all before proceeding.

### Step 2: Check documentation references (SHOW OUTPUT)

```bash
# Search docs for references to changed files/concepts
grep -rn "filename\|changed-concept\|old-behavior" docs/ README.md

# MUST show: all found references and confirmation of updates
```

**OUTPUT REQUIRED**: For EVERY file/concept you change:
- Search docs/ and README.md for references
- Show search results
- Update found references OR explain why no update needed

### Step 3: Verify systemic impact (SHOW OUTPUT)

**For changed files, search for references:**
```bash
# Example: Changed astro.config.ts
grep -rn "astro.config\|buildEnv\|base.*path" docs/

# Example: Changed test commands
grep -rn "npm run test\|playwright test" docs/ README.md
```

**OUTPUT REQUIRED**: Show what you searched for and what you found.

### Step 4: Check related systems

**Ask: "What OTHER systems interact with this change?"**
- Changed code → check docs, tests, configs
- Changed config → check code, docs, scripts that reference it
- Removed tool → search ALL references across entire repo
- Changed URL → check ALL files (grep -rn "old-url")

**OUTPUT REQUIRED**: State what systems you checked and results.

### Step 5: Verification summary (REQUIRED FORMAT)

Before committing, output:
```
Pre-commit verification:
✅ Pattern search: 0 results (all instances fixed)
✅ Documentation search: found 3 refs in docs/, updated all 3
✅ Systemic impact: checked tests/, configs/, no updates needed
✅ Related systems: [list what you checked]
```

**NO COMMIT without showing this verification summary.**

### ENFORCEMENT

This is NOT optional. This is NOT a suggestion. Before ANY commit:

1. Execute the search commands above
2. Show the output in your response
3. Fix everything found
4. Show verification summary
5. THEN commit

**Failure mode**: Committing without showing verification output violates this protocol.

## Review Response Protocol

**CRITICAL: Review comments MUST trigger Pre-Commit Verification Protocol.**

**When addressing review comments:**

1. **Check for architecture problem pattern:**

   **STOP and analyze if:**
   - 10+ rounds of similar fixes
   - Environment-specific drift (local vs staging vs production)
   - User mentions: "count mismatches," "variable settings," "important details missed"
   - Documentation keeps drifting from reality

   **If pattern detected:**
   - This is scattered config/architecture problem, not individual fix problem
   - Read config files: astro.config.ts, src/config/index.ts, workflows
   - Propose config abstraction layer:
     - Centralized config registry with metadata
     - Auto-generated docs from config
     - Validation script (CI check: code vs docs)
   - THEN address individual fixes

   **Don't:** Fix docs again without addressing root cause

2. **Identify ROOT issue, not just the line**
   - Comment mentions line 25 → Find the pattern/issue CLASS
   - Example: "Line 25 uses /" → Issue is "hardcoded root paths break BASE_URL"

3. **Identify the PATTERN type:**
   - Missing tests? → Check ALL features for test coverage gaps
   - Missing comment? → Check ALL similar code for comment patterns
   - Systemic gap? → Map ALL affected systems (sitemap, robots.txt, etc.)
   - Inconsistency? → Find what it should match and ensure parity

4. **BEFORE fixing, execute verification searches:**
   ```bash
   # Find ALL instances of the issue
   grep -rn "pattern" relevant-paths/

   # Find ALL documentation that might reference this
   grep -rn "concept\|filename" docs/ README.md
   ```
   **SHOW OUTPUT** before proceeding with fixes.

5. **Fix comprehensively**
   - Fix the specific issue mentioned
   - Fix ALL instances of the pattern found
   - Add missing tests/comments/docs to match existing code
   - Update ALL interacting systems

6. **MANDATORY: Execute Pre-Commit Verification Protocol**
   - Run all verification searches
   - Show output for each search
   - Provide verification summary
   - THEN commit

**Never fix "just that line" - fix the entire issue class. Never commit without verification output.**

## Communication Style
- Provide clear, numbered steps for complex tasks
- State assumptions upfront
- Ask clarifying questions before exploration
- Summarize findings in <100 words when possible
- Skip unnecessary engagement phrases ("You're right!", "Perfect!", "Good catch!")
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
4. **User authority:** User explicit instructions override all written rules
5. **Scope sensitivity:** Some rules are scope-dependent (e.g., quality gates for code vs docs)

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