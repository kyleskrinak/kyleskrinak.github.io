# Documentation Index

Welcome! This directory contains all documentation for the Astro blog project. Use the links below to navigate to what you need.

## 🚀 Getting Started

**For new developers or contributors:**
- [Local Setup](./getting-started/) - Running the project locally
- [Tech Stack](./getting-started/tech-stack.md) - Technology overview (when created)
- [File Structure](./getting-started/file-structure.md) - How the project is organized (when created)

## 🔧 Operations

**For deployments and maintenance:**
- [Deployment Guide](./operations/deployment.md) - How to deploy to staging and production
- [Maintenance](./operations/maintenance.md) - Health checks and monitoring (when created)
- [Troubleshooting](./operations/troubleshooting.md) - Common issues and fixes (when created)

## ✨ Features

**Understanding project capabilities:**
- [Special Implementations](./features/special-implementations.md) - Custom features and why they exist
- [Architecture Overview](./features/architecture.md) - How it all fits together (when created)

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
- **[reports/](../reports/)** - Generated test and performance reports

---

## Quick Links by Role

### 👨‍💻 Developer
1. [Local Setup](./getting-started/)
2. [File Structure](./getting-started/file-structure.md)
3. [Special Features](./features/special-implementations.md)
4. [Testing](./testing/)

### 🚀 DevOps/Deployment
1. [Deployment Guide](./operations/deployment.md)
2. [Pre-Launch Gaps](./launch/pre-launch-gaps.md)
3. [Launch Checklist](./launch/launch-checklist.md)

### 📖 Understanding the Project
1. [Migration Status](./migration/status.md)
2. [Performance Analysis](./migration/jekyll-astro-comparison.md)
3. [Special Features](./features/special-implementations.md)
4. [Presentations](./migration/presentations-deployment.md)

### 🔍 Troubleshooting
1. [Troubleshooting Guide](./operations/troubleshooting.md)
2. [Pre-Launch Gaps](./launch/pre-launch-gaps.md)
3. [Test Findings](./testing/findings.md)

---

## File Organization

```
docs/
├── index.md                           # You are here
│
├── getting-started/                   # For first-time users
│   ├── index.md
│   ├── local-setup.md
│   ├── tech-stack.md
│   └── file-structure.md
│
├── operations/                        # For deployment and maintenance
│   ├── deployment.md
│   ├── maintenance.md
│   └── troubleshooting.md
│
├── features/                          # Understanding capabilities
│   ├── special-implementations.md
│   └── architecture.md
│
├── migration/                         # Historical context
│   ├── status.md
│   ├── url-mapping.md
│   ├── jekyll-astro-comparison.md
│   ├── presentations-deployment.md
│   └── presentations-fix.md
│
├── launch/                            # Current launch status
│   ├── launch-ready.md
│   ├── pre-launch-gaps.md
│   └── launch-checklist.md
│
├── testing/                           # QA and validation
│   ├── visual-regression.md
│   └── findings.md
│
├── link-checking.md                   # Two-tier link validation
│
└── archive/                           # Historical documentation
    ├── README.md
    ├── migration/
    └── launch/
```

---

**Last Updated**: February 16, 2026
**Status**: Documentation updated - link checking consolidated to two-tier system
