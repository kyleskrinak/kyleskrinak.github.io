# Code Change Process

This document defines how to implement code changes systematically, ensuring consistency across the codebase and preventing inconsistencies that require rework.

## Overview

Code changes must follow a structured process: **explore → plan → implement → verify**. This prevents gaps where changes introduce inconsistencies across related files, configuration, and documentation.

## Phase 1: Exploration

Before writing any code, map the full scope of the change.

### 1. Identify Related Files

Find all files that interact with or depend on the area you're changing:

- **Direct dependencies**: Files you'll modify
- **Configuration files**: Environment variables, build config, feature flags
- **Related logic**: Files in different layers that use the same patterns (e.g., robots.txt + Layout meta tags)
- **Documentation**: Gitflow docs, deployment docs, architectural notes

**Example**: Changing SEO indexing logic requires checking:
- Layout.astro (meta tags)
- robots.txt.ts (crawling directives)
- Environment config (PUBLIC_DEPLOY_ENV, isStaging logic)
- Deployment docs (if environment behavior changed)

### 2. Document Assumptions

Write down your understanding of the current behavior:
- How does the system currently work?
- What environments exist and how do they differ?
- What is the intended behavior after the change?
- Are there conflicting or redundant mechanisms?

This creates a record of your thinking and helps catch errors before implementation.

### 3. Map Dependencies

Understand how files relate:
- Does this change affect multiple layers (HTML, config, deploy)?
- Are there feature flags or environment conditionals involved?
- What is the precedence if multiple mechanisms exist (e.g., robots.txt vs. meta tag)?

## Phase 2: Plan (Before Coding)

Present your exploration findings and planned approach to stakeholders for approval.

### Planning Checklist

- [ ] All related files identified and reviewed
- [ ] Assumptions documented explicitly
- [ ] Behavior change clearly described (current → intended)
- [ ] Cross-file alignment strategy defined (how will you keep them in sync?)
- [ ] Documentation updates identified

**Do not code until this is approved.**

## Phase 3: Implementation

### Code Change Standards

1. **Consistency First**
   - Check every related file simultaneously
   - Ensure logic in different layers aligns (e.g., if robots.txt says "Allow", HTML meta shouldn't say "noindex")
   - Avoid redundancy (e.g., don't explicitly state defaults like `index,follow` when no tag achieves the same)

2. **Clear Comments**
   - Explain **why** the code exists, not what it does
   - Document environment-specific behavior
   - Reference related files if logic spans multiple places
   - Example:
     ```jsx
     {/* Staging is deindexed to prevent preview builds from appearing in search results.
         Production uses default indexing (no explicit tag needed).
         Related: robots.txt.ts (staging: Disallow: /, production: Allow: /) */}
     {isStaging && <meta name="robots" content="noindex,nofollow" />}
     ```

3. **Atomic Changes**
   - Make the complete change across all related files in one commit
   - Don't split the change if it requires updates in multiple places
   - All related files should be in sync before pushing

### Commit Message Standards

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Body should document**:
- What changed across files
- Why consistency matters
- Any environment-specific behavior

Example:
```
fix(seo): align indexing logic across meta tags and robots.txt

- Staging meta tag: noindex,nofollow (prevent preview indexing)
- Production meta tag: none (use default indexing behavior)
- robots.txt already aligned: staging blocks all, production allows all
- Canonical tag documented for optional external content pointing

Ensures robots.txt and HTML directives don't conflict.
```

## Phase 4: Verification

Before submitting for review:

### Cross-File Audit

- [ ] Related files reviewed for consistency
- [ ] No conflicting directives (e.g., robots.txt allows but meta says noindex)
- [ ] No redundancy (e.g., explicit defaults that achieve nothing)
- [ ] Comments explain intent and reference related files if applicable
- [ ] Commit message accurately describes all changes

### Documentation Sync

- [ ] Update gitflow.md if process changes
- [ ] Update deployment.md if environment behavior changes
- [ ] Update build-configuration.md if config logic changes
- [ ] No docs contradict the implementation

### Build & Local Test

```bash
npm run build
# Verify no build errors
# Check generated artifacts make sense
```

## Anti-Patterns (Never)

- ❌ Change one file without checking related files
- ❌ Make assumptions without documenting them
- ❌ Add explicit defaults (e.g., `index,follow` when no tag achieves the same)
- ❌ Leave conflicting logic in different layers (robots.txt vs. meta tags)
- ❌ Submit code for review without stakeholder approval on approach
- ❌ Update code but leave docs inconsistent
- ❌ Write comments explaining what the code does, not why it exists

## Example Workflow

**Scenario**: Add a feature flag to gate analytics loading

### Exploration
- Check: Layout.astro (where script loads), environment config (what variables exist), deployment.md (how flags work)
- Document: Current behavior (always loads in production), intended behavior (only load if token provided), related env vars

### Planning
- Propose: Use PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN presence as the gate
- Get approval: Makes sense, aligns with existing pattern

### Implementation
- Update: Layout.astro (add conditional), verify: scripts/analytics.ts (no changes needed), check: docs (deployment.md already explains env vars)
- Commit: All changes together with clear message explaining the gate logic

### Verification
- Cross-file: Layout uses token check, no conflicts elsewhere
- Docs: deployment.md already covers env vars, no updates needed
- Build: npm run build passes
- Ready to merge

## Questions

**Q: What if I discover inconsistencies during exploration?**

A: Document them and propose fixes in your plan. Don't code around them—fix them as part of the change.

**Q: What if a change only touches one file?**

A: Still do exploration. A single-file change might have undiscovered dependencies or documentation implications.

**Q: Can I skip the planning phase for small changes?**

A: No. The planning phase is where most inconsistencies are caught. Even small changes need stakeholder approval on approach.
