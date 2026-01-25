# Operations & Deployment

This section covers deploying, maintaining, and troubleshooting the Astro blog in production.

## Development & Process

- **[Code Change Process](./code-change-process.md)** - Systematic approach to code changes: explore, plan, implement, verify
- **[GitFlow Workflow](./gitflow.md)** - Branching strategy and PR workflow for features and releases

## Build & Configuration

- **[Build & Configuration Guide](./build-configuration.md)** - Build scripts, Pagefind setup, and debugging

## Deployment

- **[Deployment Guide](./deployment.md)** - Complete instructions for staging and production deployments

### Quick Deploy
```bash
# To staging (GitHub Pages)
git push origin staging

# To production (AWS)
git push origin main
```

## Maintenance & Monitoring

- **[Maintenance Checklist](./maintenance.md)** - Regular health checks and monitoring (when created)
- **[Troubleshooting Guide](./troubleshooting.md)** - Solving common issues (when created)

## Key Information

**Staging Environment**:
- URL: https://kyleskrinak.github.io/astro-blog/
- Deployed on: GitHub Pages
- Triggers on: Push to `staging` branch

**Production Environment**:
- URL: https://kyle.skrinak.com/
- Deployed on: AWS S3 + CloudFront
- Triggers on: Push to `main` branch

---

For more details, see [Deployment Guide](./deployment.md).
