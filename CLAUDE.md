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

**⚠️ CRITICAL: Verify Docker is running FIRST**

Pre-push hooks require Docker for build tests. Pushing will fail if Docker daemon is not running.

```bash
# Verify Docker is running
docker ps
# If error: "Cannot connect to the Docker daemon" → start Docker Desktop first
```

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

### After PR Merges

**Prerequisites:** Docker must be running before executing these commands (see "Before Making Changes" section).

**CRITICAL: If this repository merges PRs using GitHub's "Create a merge commit" strategy, sync branches after PRs merge to prevent divergence.**

With the "Create a merge commit" strategy, the target branch gains a merge commit that the source branch does not have until you sync it back. This workflow keeps branch history aligned after those merges.

**After develop → staging merges:**
```bash
git fetch origin
git checkout develop
git pull --ff-only origin develop
git merge --ff-only origin/staging
git push origin develop
```

**After staging → main merges:**
```bash
git fetch origin
git checkout staging
git pull --ff-only origin staging
git merge --ff-only origin/main
git push origin staging

# Then sync develop with the updated staging
git checkout develop
git pull --ff-only origin develop
git merge --ff-only origin/staging
git push origin develop
```

**If merge fails (not fast-forward):**

The branches have diverged (one or both have unique commits). This shouldn't happen in normal gitflow. Inspect what differs between the branch you're on and the branch you were trying to merge:

```bash
# If syncing staging with main failed, compare staging (HEAD) to origin/main
git log --oneline HEAD..origin/main   # What's on main but not staging
git log --oneline origin/main..HEAD   # What's on staging but not main

# If syncing develop with staging failed, compare develop (HEAD) to origin/staging
git log --oneline HEAD..origin/staging    # What's on staging but not develop
git log --oneline origin/staging..HEAD    # What's on develop but not staging
```

Then either create a merge commit or resolve manually:

```bash
# If syncing staging with main failed:
git fetch origin
git checkout staging
git merge origin/main --no-edit  # Create a merge commit
git push origin staging

# If syncing develop with staging failed:
git fetch origin
git checkout develop
git merge origin/staging --no-edit  # Create a merge commit
git push origin develop

# OR resolve the divergence manually
```

**Why this is necessary:**
- With "Create a merge commit" strategy, target branches get merge commits that source branches don't have
- Without syncing, future PRs show duplicate commits in history (though file diffs are correct)
- `--ff-only` safely fast-forwards to include the merge commit without creating extra commits
- Using `origin/staging` and `origin/main` ensures you merge the latest remote state, not stale local branches

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

   **Expected failures when adding a new blog post (not real regressions):**
   - `npm run check:links`: self-referential canonical URL (e.g. `https://kyle.skrinak.com/posts/<slug>/`) returns 404 because the post isn't deployed yet. Resolves automatically after deploy.
   - `npm run test:visual`: home page, blog archive, and archives page snapshots fail with small height differences (a few px to ~60px) because the new post changes listing-page length across viewports. Update baselines with `npm run test:visual:baseline` (ask first).
   - If OTHER tests fail, or visual diffs appear on pages unrelated to listings (individual posts, standalone pages), those ARE real and need investigation.

5. **Never commit without verification**

## Text Processing, Validation, Performance Rules

**Text parsing/strings:** Use exclusive range end (`pos < range.end`). Account for newlines in offsets (running offset, not `join('\n').length`). Never `.replace(substring, '')` on content that may repeat — use position ranges, slice, rebuild. Always `.trim()` before exact comparison (CRLF vs LF). Handle malformed input (unclosed blocks → extend range to `content.length`). Throw on missing expected resources; don't silently return empty.

**Data validation:** Apply `.trim().min(1).optional()` to all text fields. Distinguish on-page vs metadata contexts. Use blocklists for dangerous protocols, not allowlists (allowlists block valid relative URLs).

**Web performance:** `sizes` attribute must match actual container width, not viewport. Always include `width`/`height` on images (including SVGs) for CLS prevention.

## Dependency/Tool Change Protocol

When removing, replacing, or consolidating tools/dependencies:

1. Grep `docs/`, `README.md`, and `tests/` for references to the old tool — update every reference (command examples, workflow docs, architecture descriptions, tech-stack lists). No orphans.
2. For workflow changes: verify conditional logic. Common gotcha: `continue-on-error` + `if: failure()` won't fire as expected — capture exit codes explicitly.
3. Test the docs you write — run the commands, don't assume; confirm `package.json` scripts match what docs claim.
4. Delete obsolete code: scripts, config files, unused utilities. Grep `scripts/*.js` for orphans.

Example: replacing `broken-link-checker` with `htmltest` required updating `docs/link-checking.md`, `docs/index.md`, `README.md`, and searching for "broken-link-checker" and "linkwatch".

## Pre-Commit Verification Protocol

Before any commit that changes code/config:

1. **Search for all instances** of the pattern being changed across `src/`, `scripts/`, `tests/`, `public/` — fix every occurrence, not just the reported one.
2. **Check documentation** (`docs/`, `README.md`) for references to the changed files/concepts and update them.
3. **Check interacting systems**: changed code → docs/tests/configs; changed config → code/scripts referencing it; removed tool → all repo-wide references; changed URL → grep all files.

Report a one-line summary of what you searched and what you fixed before committing. No commit without it.

## Review Response Protocol

When addressing review comments:

1. **Architecture-problem pattern**: if you're in 10+ rounds of similar fixes, environment-specific drift (local vs staging vs prod), or repeatedly-drifting docs — STOP. The root is scattered config/architecture, not individual lines. Read config files, propose an abstraction layer (centralized registry, auto-generated docs, validation script) first, then address individual fixes.
2. **Fix the pattern, not the line**: a comment on one case means find ALL instances of the same issue class and fix together.
3. Run the Pre-Commit Verification Protocol above before committing.

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

## Filename Convention
- Blog post files in `src/content/blog/` MUST be lowercase-kebab-case (e.g., `2026-04-19-sculpting-down.md`, not `2026-04-19-Sculpting-Down.md`)
- Format: `YYYY-MM-DD-slug.md` where `slug` is lowercase words joined by hyphens
- **Why:** `getPath()` (`src/utils/getPath.ts`) uses `post.id` directly for the URL slug with no lowercasing. Keeping filenames lowercase-kebab-case ensures the filename matches the generated URL with no dependency on any implicit normalization elsewhere. It also avoids case-sensitivity bugs that macOS (case-insensitive APFS) hides but Linux CI/deploy targets surface as 404s.

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