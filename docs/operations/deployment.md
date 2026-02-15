# Deployment Guide

This document describes the deployment process for the Astro blog migration.

## Overview

The Astro blog supports two deployment pipelines:

1. **Staging**: Deployed to GitHub Pages on pushes to the `staging` branch
2. **Production**: Deployed to AWS S3 + CloudFront on pushes to the `main` branch

## GitHub Pages Staging Deployment

### Setup

No additional setup required. GitHub Pages is automatically configured when you enable it in repository settings.

### Process

1. Push code to the `staging` branch
2. GitHub Actions automatically builds the site
3. Site is deployed to GitHub Pages staging URL

### Access

- URL: `https://kyleskrinak.github.io/` (or your configured Pages URL)

## AWS Production Deployment

### Prerequisites

1. AWS account with S3 bucket for hosting (`kyle.skrinak.com`)
2. CloudFront distribution pointing to S3 bucket
3. IAM role with S3 and CloudFront permissions
4. GitHub OIDC integration configured in AWS

### AWS IAM Setup

Create an IAM role with the following trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:kyleskrinak/astro-blog:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

Attach a policy with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::kyle.skrinak.com",
        "arn:aws:s3:::kyle.skrinak.com/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
    }
  ]
}
```

### GitHub Secrets Setup

Add the following secrets to the repository:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCOUNT_ID` | Your AWS account ID |
| `AWS_ROLE_NAME` | Name of the IAM role created above (e.g., `astro-deploy-role`) |
| `AWS_S3_BUCKET` | S3 bucket name (e.g., `kyle.skrinak.com`) |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID |

### Process

1. Push code to the `main` branch
2. GitHub Actions automatically builds the site
3. Build is uploaded to S3
4. CloudFront cache is invalidated
5. Site is live at https://kyle.skrinak.com/

### Cache Headers

The production workflow sets up intelligent caching:

- **HTML files**: 5 minutes (for frequent updates)
- **JS/CSS**: 1 hour (for moderate caching)
- **Assets** (`_astro/`, `_pagefind/`): 1 year with `immutable` flag (versioned by build)

## Environment Variables

Create a `.env.local` file (not committed to git) with:

```env
# Google Analytics (optional, used in GoogleAnalytics component)
PUBLIC_GA_ID=G-XXXXX

# Disqus comments (configured in DisqusComments component)
PUBLIC_DISQUS_SHORTNAME=kds38-duke-blog
```

## Monitoring Deployments

### GitHub Actions

View deployment status in the repository Actions tab:
- Staging: https://github.com/kyleskrinak/astro-blog/actions?query=branch%3Astaging
- Production: https://github.com/kyleskrinak/astro-blog/actions?query=branch%3Amain

### CloudFront

Monitor cache performance and create-invalidation metrics in AWS CloudFront console.

### Link Validation

Daily link validation runs and creates GitHub issues for broken links. View in:
- Issues: https://github.com/kyleskrinak/astro-blog/issues

## Troubleshooting

### Build Fails

1. Check GitHub Actions logs for specific errors
2. Run `npm run build` locally to reproduce
3. Check for YAML parsing errors in front matter
4. Ensure all images and assets are accessible

### S3 Upload Fails

1. Verify AWS credentials and permissions
2. Check S3 bucket name in secrets
3. Ensure IAM role trust policy is correct
4. Review CloudTrail for access denied errors

### CloudFront Not Updating

1. Verify CloudFront distribution ID in secrets
2. Check CloudFront invalidation status in AWS console
3. Verify invalidation path is correct (`/*`)
4. Clear browser cache or use incognito mode

## Local Preview

Build and preview locally before deploying:

```bash
npm run build
npm run preview
# Visit http://localhost:4321
```

## Rollback

To rollback to a previous version:

1. Revert the commit on `main` branch
2. Push to trigger redeployment
3. CloudFront cache will be invalidated
4. Changes live within minutes

## Build Optimization

Build size and performance metrics:

- Typical build size: ~50MB (includes optimized images)
- Build time: ~1-2 minutes
- Pagefind index: ~200KB (compressed)
- All pages: ~40 HTML files

Monitor in GitHub Actions logs.
## Troubleshooting

### Build Fails with "cannot stat 'dist/pagefind'"

**Error**:
```
cp: cannot stat 'dist/pagefind': No such file or directory
Error: Process completed with exit code 1
```

**Root Cause**: The `npm run build` script references the wrong Pagefind output directory

**Solution**: Verify your build script matches the `pagefind.json` configuration:
- Config specifies: `output_subdir: "_pagefind"` (with underscore)
- Script should use: `cp -r dist/_pagefind public/` (with underscore)

See [Build & Configuration Guide](./build-configuration.md) for details.

### Pagefind Search Not Working

**Symptoms**: Search functionality missing or broken in production

**Check**:
1. Verify search assets exist: `aws s3 ls s3://kyle.skrinak.com/_pagefind/`
2. Check CloudFront distribution includes `_pagefind/*` paths
3. Verify `pagefind.json` config is correct
4. Check browser console for errors

**Reference**: [Build & Configuration Guide](./build-configuration.md#critical-configuration-pagefind)

### Deployment Stuck or Not Progressing

**Check**:
1. View workflow logs: GitHub Actions → Production workflow
2. Verify AWS credentials are valid
3. Check AWS IAM role permissions
4. Ensure S3 bucket exists and is accessible