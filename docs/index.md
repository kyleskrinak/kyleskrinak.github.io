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

## 📚 Migration History

**Jekyll → Astro migration (completed Jan 2026):**
- See [CHANGELOG.md](../CHANGELOG.md) "Jekyll → Astro Migration" section for:
  - Performance improvements (Lighthouse scores, build time)
  - Technical decisions (presentations architecture, URL structure)
  - Breaking changes (none - full backward compatibility)
  - Migration process overview

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

### 📖 Understanding the Project
1. [Migration History](../CHANGELOG.md) - See "Jekyll → Astro Migration" section
2. [Special Features](./features/special-implementations.md)

### 🔍 Troubleshooting
1. [Troubleshooting Guide](./operations/troubleshooting.md)
2. [Test Findings](./testing/findings.md)

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
└── link-checking.md                   # Two-tier link validation
```

---

**Last Updated**: March 15, 2026
**Status**: Documentation updated - visual regression testing in production, link checking two-tier system
