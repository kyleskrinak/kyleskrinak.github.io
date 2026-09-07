# Operations & Deployment

This section covers deploying, maintaining, and troubleshooting the Astro blog in production.

## Development & Process

- **[Code Change Process](./code-change-process.md)** - Systematic approach to code changes: explore, plan, implement, verify
- **[GitFlow Workflow](./gitflow.md)** - Branching strategy and PR workflow for features and releases

## Build & Configuration

- **[Build & Configuration Guide](./build-configuration.md)** - Build scripts, Pagefind setup, and debugging

## Deployment

- **[Deployment Guide](./deployment.md)** - Complete instructions for production deployment

### Quick Deploy
```bash
# To production (AWS) — via PR: develop -> main
git push origin develop
gh pr create --base main --head develop
```

## Maintenance & Monitoring

- **[Maintenance Guide](./maintenance.md)** - Regular health checks and monitoring
- **[Troubleshooting Guide](./troubleshooting.md)** - Solving common issues

## Security & Dependencies

- **[Supply-Chain Security](./supply-chain.md)** - Single source of truth: Renovate, pre-install audit, CI gates, and manually maintained SHA pins
- **[Dependency Pins](./dependency-pins.md)** - npm `overrides` for transitive CVE advisories

## Key Information

**Production Environment**:
- URL: https://kyle.skrinak.com/
- Deployed on: AWS S3 + CloudFront
- Triggers on: Push to `main` branch

---

For more details, see [Deployment Guide](./deployment.md).
