# Operations & Deployment

This section covers deploying, maintaining, and troubleshooting the Astro blog in production.

## Development & Process

- **[Code Change Process](./code-change-process.md)** - Systematic approach to code changes: explore, plan, implement, verify
- **[GitFlow Workflow](./gitflow.md)** - Branching strategy and PR workflow for features and releases

## Build & Configuration

- **[Build & Configuration Guide](./build-configuration.md)** - Build scripts, Pagefind setup, and debugging

## Deployment

- **[Deployment Guide](./deployment.md)** - Complete instructions for production deployment and the GitHub Pages disaster-recovery fallback
- **[GitHub Pages Fallback URL Reference](./staging-url-reference.md)** - Authoritative fallback URL documentation (GitHub Pages user site constraints)

### Quick Deploy
```bash
# To production (AWS) — via PR: develop -> main
git push origin develop
gh pr create --base main --head develop

# GitHub Pages disaster-recovery fallback: manual workflow_dispatch to deploy
# (see staging-deploy.yml); a quarterly schedule trigger also runs but is a
# build-only dry run that never deploys. Not triggered by a push.
```

## Maintenance & Monitoring

- **[Maintenance Guide](./maintenance.md)** - Regular health checks and monitoring
- **[Troubleshooting Guide](./troubleshooting.md)** - Solving common issues

## Security & Dependencies

- **[Supply-Chain Security](./supply-chain.md)** - Single source of truth: Renovate, pre-install audit, CI gates, and manually maintained SHA pins
- **[Dependency Pins](./dependency-pins.md)** - npm `overrides` for transitive CVE advisories

## Key Information

**GitHub Pages (disaster-recovery fallback)**:
- URL: https://kyleskrinak.github.io/ (root - user site constraint)
- Normally serves: a redirect stub to production
- Triggers on: Manual `workflow_dispatch` to deploy (plus a quarterly `schedule`-triggered build-only dry run that never deploys), not continuous
- **See**: [GitHub Pages Fallback URL Reference](./staging-url-reference.md) for details

**Production Environment**:
- URL: https://kyle.skrinak.com/
- Deployed on: AWS S3 + CloudFront
- Triggers on: Push to `main` branch

---

For more details, see [Deployment Guide](./deployment.md).
