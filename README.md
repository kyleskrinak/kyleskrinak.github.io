# Kyle Skrinak's Blog

A modern, fast, and accessible blog built with Astro. Migrated from Jekyll with improved performance and features.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Astro](https://img.shields.io/badge/Astro-purple?style=for-the-badge&logo=astro&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

**Live Sites**:
- 🚀 [Production](https://kyle.skrinak.com/) - Main blog
- 🧪 [Staging](https://kyleskrinak.github.io/) - Testing environment (GitHub Pages user site, root path)

## ✨ Features

- ⚡ **Fast by default** - Static HTML with 1.4s LCP on production
- 🎨 **Responsive** - Works on all devices
- 🌙 **Dark mode** - Light and dark theme toggle
- 🔍 **Full-text search** - Powered by Pagefind
- ♿ **Accessible** - Lighthouse Accessibility score 94 on production
- 📱 **Mobile-first** - Perfect on phones, tablets, desktops
- 📊 **SEO-friendly** - Sitemaps, RSS feeds, canonical URLs
- 🎯 **TypeScript** - Type-safe markdown and configuration

## 📚 Documentation

All project documentation is organized in the `/docs` directory. Start here:

**👀 [Documentation Hub](./docs/index.md)** - Navigation and overview

### By Role:

| Role | Start Here |
|------|-----------|
| 👨‍💻 **Developer** | [Getting Started](./docs/getting-started/) |
| 🚀 **DevOps** | [Operations & Deployment](./docs/operations/) |
| 📖 **Understanding Project** | [Migration History](./CHANGELOG.md) - Jekyll → Astro migration summary (planning docs archived post-launch) |
| 🧪 **QA/Testing** | [Testing Guide](./docs/testing/) |

### Quick Links:

- [Local Setup](./docs/getting-started/) - Run locally in 5 minutes
- [Deployment Guide](./docs/operations/deployment.md) - How to deploy
- [Special Features](./docs/features/special-implementations.md) - Custom implementations
- [Migration History](./CHANGELOG.md) - Jekyll → Astro migration summary (planning docs archived post-launch)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Visit http://localhost:4321

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🛠️ Common Commands

```bash
npm run dev              # Start development server
npm run build            # Build production site
npm run preview          # Preview production build
npm run lint             # Check code quality
npm run format           # Auto-format code
npm run check:links      # Two-tier link checking (htmltest + Playwright)
npm run test:console     # Check for console errors
npm run test:visual      # Visual regression testing

# Configuration management
npm run config:generate  # Generate configuration docs
npm run config:validate  # Validate config consistency
npm run config:inspect   # Debug configuration values
```

## 🧪 Testing & Quality Assurance

**PR Checks** (run on PRs to staging/main):
- **Visual Regression Testing** - Playwright-based screenshot comparison with automated baseline management

**Scheduled Checks** (nightly):
- **Link Validation** - Two-tier verification (htmltest + browser) that filters false positives

**Test Suites** (run manually or in CI):
- **Console Error Detection** - Scans for JavaScript errors on key pages
- **SEO Validation** - Meta tags verification, sitemap accuracy, canonical URL checks
- **Analytics Privacy** - DNT/GPC compliance

See `/docs/testing/` for detailed guides.

## 📊 Project Structure

```
/
├── design/                  # 🎨 Graphic source files (not deployed)
├── docs/                    # 📚 All documentation (see docs/index.md)
├── src/
│   ├── content/
│   │   ├── blog/           # Blog posts (markdown/MDX)
│   │   └── pages/          # Static pages
│   ├── components/         # Reusable components
│   ├── layouts/            # Page layouts
│   ├── pages/              # Dynamic routes
│   ├── styles/             # Global styles
│   └── config/             # Configuration
├── public/
│   ├── favicon.ico         # Favicon variants
│   ├── apple-touch-icon.png
│   └── site.webmanifest    # PWA manifest
├── tests/                  # Test suites
└── package.json
```

## 💻 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Astro](https://astro.build/) |
| **Styling** | [TailwindCSS](https://tailwindcss.com/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Search** | [Pagefind](https://pagefind.app/) |
| **Testing** | [Playwright](https://playwright.dev/) |
| **Deployment** | GitHub Pages (staging) + AWS S3/CloudFront (production) |
| **CI/CD** | GitHub Actions |

## 📈 Performance

**Lighthouse Scores** (Production, pre-Disqus-removal; remeasure pending — see [issue #153](https://github.com/kyleskrinak/kyleskrinak.github.io/issues/153)):
- Performance: 80
- Accessibility: 94
- Best Practices: 77
- SEO: 100

See [CHANGELOG.md](./CHANGELOG.md) "Jekyll → Astro Migration" section for Jekyll vs. Astro migration benchmarks.

## 🚢 Deployment

Changes flow through three long-lived branches:

1. **develop** — all new work lands here; runs CI checks on every push
2. **staging** → auto-deploys to GitHub Pages for pre-production review
3. **main** → triggers production deploy to AWS S3 + CloudFront with CDN invalidation

See [Deployment Guide](./docs/operations/deployment.md) for details.

## 📋 Version History

See [CHANGELOG.md](./CHANGELOG.md) for detailed release history.

## 📝 License

Licensed under the MIT License. See [LICENSE](./LICENSE) file for details.

---

## 🤔 Need Help?

1. **Getting started?** → [Getting Started Guide](./docs/getting-started/)
2. **Something not working?** → [Troubleshooting](./docs/operations/troubleshooting.md)
3. **Want to understand why something works this way?** → [Migration History](./CHANGELOG.md)

**All documentation is in `/docs`** - start with [docs/index.md](./docs/index.md).

---

Made with ❤️ for my blog. Based on [AstroPaper](https://github.com/satnaing/astro-paper) theme.
