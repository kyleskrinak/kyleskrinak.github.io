# Operations & Deployment

This section covers deploying, maintaining, and troubleshooting the Astro blog in production.

## Development & Process

- **[Code Change Process](./code-change-process.md)** - Systematic approach to code changes: explore, plan, implement, verify
- **[GitFlow Workflow](./gitflow.md)** - Branching strategy and PR workflow for features and releases

## Build & Configuration

- **[Build & Configuration Guide](./build-configuration.md)** - Build scripts, Pagefind setup, and debugging

## Deployment

- **[Deployment Guide](./deployment.md)** - Complete instructions for staging and production deployments
- **[Staging URL Reference](./staging-url-reference.md)** - Authoritative staging URL documentation (GitHub Pages user site constraints)

### Quick Deploy
```bash
# To staging (GitHub Pages)
git push origin staging

# To production (AWS)
git push origin main
```

## Maintenance & Monitoring

- **[Maintenance Guide](./maintenance.md)** - Regular health checks and monitoring
- **[Troubleshooting Guide](./troubleshooting.md)** - Solving common issues

## Key Information

**Staging Environment**:
- URL: https://kyleskrinak.github.io/ (root - user site constraint)
- Deployed on: GitHub Pages
- Triggers on: Push to `staging` branch
- **See**: [Staging URL Reference](./staging-url-reference.md) for details

**Production Environment**:
- URL: https://kyle.skrinak.com/
- Deployed on: AWS S3 + CloudFront
- Triggers on: Push to `main` branch

---

For more details, see [Deployment Guide](./deployment.md).
