---
description: Systematically address GitHub Copilot review comments with comprehensive pattern fixes
---

You are reviewing GitHub Copilot feedback on a pull request. Copilot often identifies specific instances of broader patterns. Your job is to fix the entire pattern comprehensively, not just the mentioned line.

## Critical Principles

1. **Fix patterns, not lines**: If Copilot mentions line 25, identify what pattern/issue CLASS that represents
2. **Search exhaustively**: Find ALL instances of the pattern across the entire codebase
3. **Check related systems**: Code changes affect docs, tests, configs, generated files
4. **Verify completeness**: Zero grep results for the problematic pattern = done
5. **Rebuild generated files**: Source changes require regenerating derived files

## Workflow

### Step 1: Analyze the Comments

For each Copilot comment:
- Identify the ROOT issue class (not just the specific instance)
- Ask: "What pattern does this represent?"
- Ask: "Where else might this pattern exist?"

**Common issue classes:**
- Missing validation/error handling
- Hardcoded values that should be configurable
- Documentation that doesn't match implementation
- Generated files out of sync with source
- Security issues (XSS, injection, escaping)
- Inconsistent naming/behavior across similar code
- Missing tests/comments where similar features have them

### Step 2: Search for ALL Instances

Before making any changes, search comprehensively:

```bash
grep -rn "pattern" src/ scripts/ public/ docs/
grep -rn "related-term" src/ docs/
```

Document how many instances you find.

### Step 3: Check ALL Related Systems

Ask: "What OTHER systems interact with this?"

**Always check:**
- [ ] Documentation (docs/, README.md) - does it reference changed code?
- [ ] Tests - do similar features have tests? Add equivalent tests
- [ ] Comments - do similar implementations have explanatory comments?
- [ ] Generated files - does source change require rebuilding?
- [ ] Configuration - does config need updating?
- [ ] Similar files - are there parallel implementations to fix?

**For specific domains:**
- **SEO changes**: Check meta tags, sitemap.xml, robots.txt, canonical tags
- **Image changes**: Check schema validation, component props, documentation
- **Build script changes**: Regenerate all outputs
- **Schema changes**: Update validation messages, documentation
- **Dependency changes**: Update docs, remove from package.json if unused

### Step 4: Fix Comprehensively

Make ONE atomic commit that:
1. Fixes the specific issue Copilot mentioned
2. Fixes ALL instances of the pattern
3. Updates ALL related systems
4. Includes regenerated files if needed
5. Adds missing tests/comments to match similar features

**Before committing, verify:**
```bash
# Pattern should return ZERO results
grep -rn "problematic-pattern" src/ scripts/ public/ docs/

# Verify generated files are rebuilt
git status  # should show generated files modified
```

### Step 5: Commit Message Format

```
fix: address Copilot review comment on [issue class]

- Specific fix for mentioned line/file
- Found and fixed N additional instances of pattern
- Updated related systems: [list systems]
- Regenerated: [list generated files]

Addresses: [describe what pattern was fixed]

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### Step 6: Verify Your Work

**Self-check questions:**
- [ ] Did I search for ALL instances? (not just the one mentioned)
- [ ] Did I fix the pattern, not just the symptom?
- [ ] Did I check ALL interacting systems?
- [ ] Did I regenerate derived/generated files?
- [ ] Did I update documentation to match code?
- [ ] Did I add tests/comments matching similar features?
- [ ] Can I grep for the pattern and get ZERO results?

**If you can't answer YES to all, you're not done.**

## Common Mistakes to Avoid

❌ **Don't**: Fix just the line mentioned
✅ **Do**: Find and fix ALL instances of the pattern

❌ **Don't**: Assume documentation is correct
✅ **Do**: Test actual behavior, update docs to match

❌ **Don't**: Fix source without regenerating outputs
✅ **Do**: Rebuild presentations, HTML, or other generated files

❌ **Don't**: Add a feature without matching tests/comments
✅ **Do**: Check similar features and match their completeness

❌ **Don't**: Change a dependency without updating docs
✅ **Do**: Search ALL docs for references and update them

## After Pushing

Once you push to staging/develop:
- The PR will automatically update
- Wait for user to report if Copilot has more feedback
- Be ready for additional rounds if patterns were missed

**Every fix should be comprehensive and complete. If Copilot is still finding issues after your fix, you didn't fix the pattern — you fixed a symptom.**
