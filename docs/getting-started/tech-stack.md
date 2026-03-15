# Technology Stack

> ⚠️ **This document is a placeholder. See README.md for current tech stack overview.**

## Quick Reference

See [README.md - Tech Stack](../../README.md#-tech-stack) for the current technology overview.

## Core Technologies

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | [Astro](https://astro.build/) | 5.x |
| **Styling** | [TailwindCSS](https://tailwindcss.com/) | 4.x |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | 5.x |
| **Search** | [Pagefind](https://pagefind.app/) | 1.x |
| **Testing** | [Playwright](https://playwright.dev/) | 1.x |
| **CI/CD** | GitHub Actions | - |
| **Deployment** | AWS S3/CloudFront (prod), GitHub Pages (staging) | - |

## Development Tools

- **Node.js**: 24.x (see `.github/actions/setup-node-build/action.yml`)
- **Package Manager**: npm
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier with Astro plugin

## Testing Stack

- **Visual Regression**: Playwright with GitHub Actions artifacts
- **Link Validation**: htmltest + Playwright two-tier system
- **Console Errors**: Playwright browser tests
- **SEO**: Custom Playwright test suites
- **Analytics Privacy**: Playwright privacy signal validation

## Infrastructure

- **Hosting (Production)**: AWS S3 + CloudFront
- **Hosting (Staging)**: GitHub Pages
- **Analytics**: Cloudflare Web Analytics
- **Comments**: Disqus (optional)
- **CI/CD**: GitHub Actions workflows

## Future Content

This document will eventually include:
- Detailed technology decisions and rationale
- Version upgrade strategy
- Dependency management approach
- Technology trade-offs and alternatives considered
- Integration patterns
- Performance optimization techniques

For current details, see:
- [README.md](../../README.md)
- [Special Implementations](../features/special-implementations.md)
- [Build Configuration](../operations/build-configuration.md)
