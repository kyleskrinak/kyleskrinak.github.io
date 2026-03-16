# Documentation Index

Welcome! This directory contains all documentation for the Astro blog project. Use the links below to navigate to what you need.

## 🚀 Getting Started

**For new developers or contributors:**
- [Local Setup](./getting-started/) - Running the project locally
- [Creating Posts](./getting-started/creating-posts.md) - Quick guide for writing blog posts
- [Image Workflow](./getting-started/images.md) - Complete guide for adding images
- [Tech Stack](./getting-started/tech-stack.md) - Technology overview
- [File Structure](./getting-started/file-structure.md) - How the project is organized

## 🔧 Operations

**For deployments and maintenance:**
- [Deployment Guide](./operations/deployment.md) - How to deploy to staging and production
- [Maintenance](./operations/maintenance.md) - Health checks and monitoring
- [Troubleshooting](./operations/troubleshooting.md) - Common issues and fixes

## ✨ Features

**Understanding project capabilities:**
- [Special Implementations](./features/special-implementations.md) - Custom features and why they exist
- [Architecture Overview](./features/architecture.md) - How it all fits together

## 📚 Migration History (Archived)

**Context about the Jekyll → Astro migration (completed Jan 2026):**
- [Archive Index](./archive/README.md) - Overview of archived documentation
- [Migration Status](./archive/migration/status.md) - Detailed completion report
- [URL Mapping](./archive/migration/url-mapping.md) - Old Jekyll URLs → New Astro URLs
- [Performance Analysis](./archive/migration/jekyll-astro-comparison.md) - Lighthouse comparison

## 🚢 Launch Information (Archived)

**Project successfully launched to production (kyle.skrinak.com) in Jan 2026:**
- [Archive Index](./archive/README.md) - Overview of archived documentation
- [Launch Readiness](./archive/launch/launch-ready.md) - What was ready for production
- [Pre-Launch Gaps](./archive/launch/pre-launch-gaps.md) - Historical gap analysis

## 🧪 Testing

**Quality assurance and validation:**
- [Link Checking](./link-checking.md) - Two-tier link validation (htmltest + Playwright)
- [Visual Regression Testing](./testing/visual-regression.md) - Screenshot-based testing approach
- [Test Findings](./testing/findings.md) - Results from test runs
- [Console Error Testing](./testing/) - Checking for browser console issues

## 📊 Additional Resources

- **[README.md](../README.md)** - Main project README at root
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history and changes

---

## Quick Links by Role

### 👨‍💻 Developer
1. [Local Setup](./getting-started/)
2. [File Structure](./getting-started/file-structure.md)
3. [Special Features](./features/special-implementations.md)
4. [Testing](./testing/)

### 🚀 DevOps/Deployment
1. [Deployment Guide](./operations/deployment.md)
2. [Pre-Launch Gaps](./archive/launch/pre-launch-gaps.md) *(archived)*

### 📖 Understanding the Project
1. [Migration Status](./archive/migration/status.md) *(archived)*
2. [Performance Analysis](./archive/migration/jekyll-astro-comparison.md) *(archived)*
3. [Special Features](./features/special-implementations.md)
4. [Presentations](./archive/migration/presentations-deployment.md) *(archived)*

### 🔍 Troubleshooting
1. [Troubleshooting Guide](./operations/troubleshooting.md)
2. [Pre-Launch Gaps](./archive/launch/pre-launch-gaps.md) *(archived)*
3. [Test Findings](./testing/findings.md)

---

## File Organization

```
docs/
├── index.md                           # You are here
│
├── getting-started/                   # For first-time users
│   ├── index.md
│   ├── creating-posts.md
│   ├── images.md
│   ├── tech-stack.md
│   └── file-structure.md
│
├── operations/                        # For deployment and maintenance
│   ├── index.md
│   ├── build-configuration.md
│   ├── code-change-process.md
│   ├── deployment.md
│   ├── gitflow.md
│   ├── maintenance.md
│   ├── seo-thin-content-resolution.md
│   ├── staging-url-reference.md
│   └── troubleshooting.md
│
├── features/                          # Understanding capabilities
│   ├── index.md
│   ├── architecture.md
│   └── special-implementations.md
│
├── testing/                           # QA and validation
│   ├── index.md
│   ├── visual-regression.md
│   └── findings.md
│
├── link-checking.md                   # Two-tier link validation
│
└── archive/                           # Historical documentation
    ├── README.md
    ├── migration/                     # Jekyll → Astro migration (Jan 2026)
    │   ├── index.md
    │   ├── status.md
    │   ├── url-mapping.md
    │   ├── jekyll-astro-comparison.md
    │   ├── presentations-deployment.md
    │   └── presentations-fix.md
    └── launch/                        # Pre-launch & launch (Jan 2026)
        ├── index.md
        ├── launch-ready.md
        └── pre-launch-gaps.md
```

---

**Last Updated**: March 15, 2026
**Status**: Documentation updated - visual regression testing in production, link checking two-tier system
