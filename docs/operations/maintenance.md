# Maintenance Guide

> ⚠️ **This document is a placeholder for future maintenance procedures.**

## Current Maintenance Tasks

For now, refer to the following existing documentation:

### Automated Monitoring

**Link Validation**:
- Automated nightly checks via `linkwatch.yml` workflow
- Creates GitHub issues when broken links are found
- See [Link Checking Guide](../link-checking.md)

**Visual Regression Testing**:
- Automated on all PRs to staging/main
- See [Visual Regression Guide](../testing/visual-regression.md)

### Manual Health Checks

**Build Health**:
```bash
npm run build          # Verify build succeeds
npm run test:visual    # Check for visual regressions
npm run check:links    # Validate all links
```

**Deployment Verification**:
- Staging: https://kyleskrinak.github.io/ (user site - root path only)
- Production: https://kyle.skrinak.com/

**Analytics Dashboard**:
- Cloudflare Web Analytics (production traffic monitoring)

### Routine Tasks

**Monthly**:
- Review GitHub Issues for automated link check failures
- Check Cloudflare Analytics for traffic patterns
- Review dependency updates (Renovate PRs and the Dependency Dashboard issue)

### Pre-install supply-chain audit (`npm run audit:deps`)

Before merging any Renovate PR or running `npm install` for a new dependency, run the audit helper locally to inspect the would-be change without executing any package code:

```sh
# Renovate PR (committed branch, clean working tree) — most common case:
git checkout <renovate-branch>
npm run audit:deps -- --base develop

# Uncommitted working-tree changes (package.json edited, not yet installed):
npm run audit:deps

# Hypothetical bump without editing package.json:
npm run audit:deps -- --package dayjs@1.11.21

npm run audit:deps -- --help                  # full usage
```

It diffs the lockfile (against `HEAD` or `--base <ref>`), surfaces publish age, verifies signatures, flags dormant-revival patterns, and emits a GO / REVIEW / BLOCK recommendation. Signatures and `npm ci --ignore-scripts` also run in CI via `.github/workflows/supply-chain-audit.yml` as a backstop. Full posture: **[Supply-Chain Security](./supply-chain.md)**.

**Quarterly**:
- Update Node.js version in workflows if needed
- Review the manually maintained supply-chain pins — GitHub Action SHAs and the `Dockerfile` base image — which Renovate does **not** manage and which do not self-update. See [Supply-Chain Security → Manually pinned](./supply-chain.md#manually-pinned-not-managed-by-renovate)
- Review npm `overrides` per the [Dependency Pins](./dependency-pins.md) checklist
- Review and archive old documentation
- Performance audit with Lighthouse

## Future Content

This document will eventually include:
- Detailed monitoring procedures
- Health check schedules
- Incident response procedures
- Backup and recovery processes
- Performance monitoring
- Security update procedures

For now, see:
- [Deployment Guide](./deployment.md) - Deployment procedures
- [GitFlow Workflow](./gitflow.md) - Development workflow
- [Troubleshooting Guide](./troubleshooting.md) - Common issues
