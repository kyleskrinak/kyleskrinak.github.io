# Scratch Notes

Ephemeral notes and temporary decisions. This file contains information that will likely become outdated.

---

## npm audit vulnerabilities (2026-03-02)

**Status:** 5 moderate severity vulnerabilities in dev dependencies - intentionally left unresolved

**Issue:** lodash 4.17.21 has prototype pollution vulnerability in `_.unset` and `_.omit` functions

**Dependency chain:**
```
lodash (vulnerable)
  ↑ yaml-language-server
    ↑ volar-service-yaml
      ↑ @astrojs/language-server
        ↑ @astrojs/check 0.9.6
```

**Why not fixed:**
- Dev dependencies only (not in production bundle)
- `npm audit fix --force` would downgrade @astrojs/check 0.9.6 → 0.9.2 (breaking change)
- Real-world risk: zero (YAML language server tooling, specific lodash functions)

**Resolution:** Wait for upstream packages to update their lodash dependency. Will resolve automatically on future `npm update`.

**Expected timeline:** Weeks to months for yaml-language-server or dependencies to update.

---

*Delete resolved items from this file as they become outdated.*
