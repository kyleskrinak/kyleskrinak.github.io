---
description: Verify root cause and exhaustively fix patterns
---

# /verify-fix

After making changes to fix an issue, run this verification checklist:

## 1. Root Cause Check
- Did I identify the ROOT issue, not just the specific line mentioned?
- What is the issue CLASS (pattern/category)?

## 2. Exhaustive Search
```bash
# Search for ALL instances of the pattern
grep -rn "pattern" src/ scripts/ public/

# After fixing, verify zero results
grep -rn "pattern" src/ scripts/ public/  # MUST be empty

# If the task explicitly involves docs, include docs/
# grep -rn "pattern" src/ scripts/ public/ docs/
```

## 3. Side Effects Check
- [ ] Documentation referencing changed files?
- [ ] PR description needs update?
- [ ] Related files with similar issues?
- [ ] Other files in same directory?

## 4. Fix Completeness
- [ ] Fixed ALL instances in ONE commit
- [ ] Verified zero results remain
- [ ] Updated docs/PR description if behavior changed

## 5. Infrastructure Code Check
If this is scripts/build/CI/tooling:
- [ ] Works in CI/CD (headless by default)?
- [ ] Resource cleanup (try/finally)?
- [ ] Defensive programming (null checks, type coercion)?
- [ ] Configurable, not hardcoded?

**Never commit until all checks pass.**
