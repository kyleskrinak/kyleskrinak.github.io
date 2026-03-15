# Troubleshooting Guide

> ⚠️ **This document is a placeholder. For immediate help, see the deployment guide.**

## Quick Links

For specific troubleshooting scenarios, see:

### Build Issues
- [Deployment Guide - Troubleshooting](./deployment.md#troubleshooting) - Build failures, S3 upload issues, CloudFront problems

### Link Checking Issues
- [Link Checking Guide](../link-checking.md) - Two-tier link validation setup and common issues

### Visual Regression Issues
- [Visual Regression Guide](../testing/visual-regression.md#troubleshooting) - Baseline issues, diff viewing

### Configuration Issues
- [Build Configuration Guide](./build-configuration.md) - Pagefind setup, composite actions

## Common Issues

### Build Failures

**Symptom**: `npm run build` fails

**Solutions**:
1. Check for YAML parsing errors in front matter
2. Verify all images and assets are accessible
3. Check TypeScript errors: `npm run sync`
4. See [Deployment Guide troubleshooting section](./deployment.md#build-fails)

### Test Failures

**Symptom**: Tests fail locally or in CI

**Solutions**:
```bash
# Visual regression - download official baseline
gh run download --name visual-baseline-main --dir tests/visual/

# Link validation - check htmltest is installed
htmltest --version

# Console errors - check dev server is running
npm run dev  # Terminal 1
npm run test:console  # Terminal 2
```

### Workflow Failures

**Symptom**: GitHub Actions workflow fails

**Solutions**:
1. Check workflow logs in Actions tab
2. Verify secrets are configured (use `secrets-check.yml` workflow)
3. Check AWS credentials and permissions
4. See [Deployment Guide](./deployment.md#troubleshooting)

## Future Content

This document will eventually include:
- Detailed error messages and solutions
- Common development environment issues
- Debugging procedures
- Performance troubleshooting
- Security issue resolution
- Integration troubleshooting (Cloudflare, AWS, etc.)

For current issues, check:
- [Deployment Guide](./deployment.md)
- [Build Configuration](./build-configuration.md)
- [GitFlow Workflow](./gitflow.md)
- Project [GitHub Issues](https://github.com/kyleskrinak/astro-blog/issues)
